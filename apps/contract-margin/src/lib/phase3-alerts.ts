import Decimal from "decimal.js";
import { exposure, PortfolioRow } from "./finance";
import { ContractTerms, DailyCost, monthlyForecast } from "./phase3-forecast";

export type AlertSettings = {
  floor_exposure_usd:string; projected_exposure_usd:string;
  daily_spike_pct:string; daily_spike_min_usd:string;
  reconciliation_gap_usd:string; stale_hours:number;
  timezone:string; quiet_start_hour:number; quiet_end_hour:number;
  digest_weekday:number; digest_hour:number;
};
export const defaultAlertSettings:AlertSettings={
  floor_exposure_usd:"25",projected_exposure_usd:"50",
  daily_spike_pct:"50",daily_spike_min_usd:"50",reconciliation_gap_usd:"50",
  stale_hours:24,timezone:"UTC",quiet_start_hour:20,quiet_end_hour:8,
  digest_weekday:1,digest_hour:8,
};
export type Candidate={ customerId:string|null;kind:"floor_breach"|"projected_breach"|
  "daily_spike"|"stale_data"|"reconciliation_gap";severity:"material"|"critical";
  exposureUsd:string;evidence:Record<string,unknown> };
type Connection={provider:string;connected_at:string;disconnected_at:string|null;
  last_success_at:string|null;last_error:string|null};
type Reconciliation={provider:string;status:string;variance_usd:string|null;reported_usd:string|null;
  covered_days:number;total_days:number};

export function alertCandidates(input:{portfolio:PortfolioRow[];daily:DailyCost[];
  contracts:Map<string,ContractTerms>;connections:Connection[];reconciliation:Reconciliation[];
  settings:AlertSettings;defaultTarget:string;orgId:string;asOf:Date}) {
  const {portfolio,daily,contracts,connections,reconciliation,settings,defaultTarget,orgId,asOf}=input;
  const candidates:Candidate[]=[];
  const today=new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth(),asOf.getUTCDate()));
  const previous=new Date(today);previous.setUTCDate(previous.getUTCDate()-1);
  const previousDay=previous.toISOString().slice(0,10);
  const priorStart=new Date(previous);priorStart.setUTCDate(priorStart.getUTCDate()-7);
  const priorStartDay=priorStart.toISOString().slice(0,10);
  for(const row of portfolio){
    const observed=exposure(row);
    if(observed.gte(settings.floor_exposure_usd)&&observed.gt(0))
      candidates.push({customerId:row.customer_id,kind:"floor_breach",
        severity:observed.gte(new Decimal(settings.floor_exposure_usd).times(3))?"critical":"material",
        exposureUsd:observed.toFixed(2),evidence:{customerName:row.customer_name,
          knownCostUsd:row.known_cost_usd,revenueUsd:row.revenue_usd,
          targetMarginPct:row.target_margin_pct,unknownCostEvents:row.unknown_cost_events,
          route:`/o/${orgId}/customers/${row.customer_id}`}});
    const terms=contracts.get(row.customer_id);
    if(terms){
      const forecast=monthlyForecast(row.customer_id,daily,terms,defaultTarget,asOf);
      if(forecast.confidence==="sufficient_run_rate"&&
        new Decimal(forecast.floorExposureUsd).gte(settings.projected_exposure_usd)&&
        new Decimal(forecast.floorExposureUsd).gt(0))
        candidates.push({customerId:row.customer_id,kind:"projected_breach",
          severity:new Decimal(forecast.floorExposureUsd).gte(
            new Decimal(settings.projected_exposure_usd).times(3))?"critical":"material",
          exposureUsd:forecast.floorExposureUsd,
          evidence:{customerName:row.customer_name,...forecast,
            route:`/o/${orgId}/customers/${row.customer_id}`}});
    }
    const rows=daily.filter((item)=>item.customer_id===row.customer_id);
    const latest=rows.find((item)=>item.day===previousDay);
    const prior=rows.filter((item)=>item.day>=priorStartDay&&item.day<previousDay);
    if(latest&&Number(latest.unknown_cost_events)===0&&prior.length>=5&&
      prior.every((item)=>Number(item.unknown_cost_events)===0)){
      const average=prior.reduce((sum,item)=>sum.plus(item.known_cost_usd),new Decimal(0)).div(7);
      const latestCost=new Decimal(latest.known_cost_usd);
      const increase=latestCost.minus(average);
      if(average.gt(0)&&increase.gte(settings.daily_spike_min_usd)&&
        latestCost.gte(average.times(new Decimal(1).plus(new Decimal(settings.daily_spike_pct).div(100)))))
        candidates.push({customerId:row.customer_id,kind:"daily_spike",
          severity:latestCost.gte(average.times(3))?"critical":"material",
          exposureUsd:increase.toFixed(2),evidence:{customerName:row.customer_name,
            day:previousDay,dayCostUsd:latestCost.toFixed(2),priorSevenDayAverageUsd:average.toFixed(2),
            observedPriorDays:prior.length,route:`/o/${orgId}/customers/${row.customer_id}`}});
    }
  }
  for(const connection of connections){
    if(connection.disconnected_at) continue;
    const lastEvidence=connection.last_success_at??connection.connected_at;
    const lagHours=(asOf.valueOf()-Date.parse(lastEvidence))/3_600_000;
    if(lagHours>settings.stale_hours)
      candidates.push({customerId:null,kind:"stale_data",severity:lagHours>settings.stale_hours*2?"critical":"material",
        exposureUsd:"0",evidence:{provider:connection.provider,lastSuccessAt:connection.last_success_at,
          lagHours:Number.isFinite(lagHours)?Math.round(lagHours):null,lastError:connection.last_error,
          route:`/o/${orgId}/reconcile`}});
  }
  for(const item of reconciliation){
    const gap=item.variance_usd===null?null:new Decimal(item.variance_usd).abs();
    if(gap&&gap.gte(settings.reconciliation_gap_usd)&&gap.gt(0))
      candidates.push({customerId:null,kind:"reconciliation_gap",
        severity:gap.gte(new Decimal(settings.reconciliation_gap_usd).times(3))?"critical":"material",
        exposureUsd:gap.toFixed(2),evidence:{provider:item.provider,status:item.status,
          reportedUsd:item.reported_usd,varianceUsd:item.variance_usd,
          coveredDays:item.covered_days,totalDays:item.total_days,route:`/o/${orgId}/reconcile`}});
  }
  return candidates;
}

export function localClock(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,weekday:"short",year:"numeric",
    month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const value=(type:string)=>parts.find((part)=>part.type===type)?.value??"";
  return {hour:Number(value("hour")),weekday:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(value("weekday")),
    date:`${value("year")}-${value("month")}-${value("day")}`};
}
export function inQuietHours(hour:number,start:number,end:number){
  return start===end?false:start<end?hour>=start&&hour<end:hour>=start||hour<end;
}
