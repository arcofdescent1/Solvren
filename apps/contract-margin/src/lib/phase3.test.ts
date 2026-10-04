import { describe,expect,it } from "vitest";
import { calculateQuoteScenario, quoteScenarioSchema, WorkflowSample } from "./quote-finance";
import { monthlyForecast } from "./phase3-forecast";
import { alertCandidates, defaultAlertSettings, inQuietHours } from "./phase3-alerts";
import { PortfolioRow } from "./finance";

const sample:WorkflowSample={workflow_id:"answer",completed_runs:40,priced_runs:40,
  unknown_runs:0,median_unit_usd:"20",p90_unit_usd:"50",observed_cost_usd:"1000",
  first_outcome_at:"2026-09-01T00:00:00Z",last_outcome_at:"2026-09-30T00:00:00Z"};
function scenario(){return quoteScenarioSchema.parse({label:"Base",monthlyOutcomes:100,
  proposedFeeUsd:"5000",discountPct:0,includedOutcomes:100,overageUsd:"0",
  volumeStressPct:25,targetMarginPct:50,mix:[{workflowId:"answer",sharePct:100,
    manualMedianUsd:null,manualAdverseUsd:null}]});}

describe("quote decision economics",()=>{
  it("shows a median approval that fails the adverse floor and a concrete price",()=>{
    const result=calculateQuoteScenario(scenario(),[sample]);
    expect(result.median.marginPct).toBe("60.00");
    expect(result.adverse.marginPct).toBe("-25.00");
    expect(result.requiredBaseFeeUsd).toBe("12500.00");
    expect(result.breakevenOutcomes).toBe("250");
    expect(result.confidence).toBe("observed");
  });
  it("requires explicit manual assumptions when sample is sparse",()=>{
    expect(()=>calculateQuoteScenario(scenario(),[{...sample,priced_runs:29}])).toThrow(/fewer than 30/);
    const input=scenario();
    input.mix[0].manualMedianUsd="25";input.mix[0].manualAdverseUsd="60";
    expect(calculateQuoteScenario(input,[{...sample,priced_runs:29}]).confidence)
      .toBe("manual_assumptions");
  });
  it("rejects an adverse assumption below the median",()=>{
    const input=scenario();input.mix[0].manualMedianUsd="30";input.mix[0].manualAdverseUsd="20";
    expect(()=>calculateQuoteScenario(input,[sample])).toThrow(/at least the median/);
  });
});

describe("run-rate and alert quality",()=>{
  it("labels sparse activity and prevents a projected-breach alert",()=>{
    const asOf=new Date("2026-10-21T12:00:00Z");
    const daily=[{customer_id:"c1",day:"2026-10-20",known_cost_usd:"300",
      unknown_cost_events:0,completed_outcomes:40,usage_events:1}];
    const terms={billing_period:"monthly",base_fee_usd:"1000",included_outcomes:100,
      overage_usd:"0",discount_pct:"0",target_margin_pct:"50"};
    const forecast=monthlyForecast("c1",daily,terms,"50",asOf);
    expect(forecast.confidence).toBe("sparse_or_incomplete");
    const row:PortfolioRow={customer_id:"c1",customer_name:"Acme",customer_external_id:"acme",
      owner_email:null,renewal_on:null,revenue_usd:"1000",known_cost_usd:"300",
      model_cost_usd:"300",tool_cost_usd:"0",human_cost_usd:"0",other_cost_usd:"0",
      completed_outcomes:40,failed_outcomes:0,usage_events:1,unknown_cost_events:0,
      target_margin_pct:"50",latest_event_at:null,top_workflow:"answer"};
    const candidates=alertCandidates({portfolio:[row],daily,contracts:new Map([["c1",terms]]),
      connections:[],reconciliation:[],settings:defaultAlertSettings,
      defaultTarget:"50",orgId:"org",asOf});
    expect(candidates.some((item)=>item.kind==="projected_breach")).toBe(false);
  });
  it("recognizes quiet hours across midnight",()=>{
    expect(inQuietHours(23,20,8)).toBe(true);
    expect(inQuietHours(7,20,8)).toBe(true);
    expect(inQuietHours(8,20,8)).toBe(false);
  });
  it("gives a newly connected supplier the configured first-sync window",()=>{
    const asOf=new Date("2026-10-21T12:00:00Z");
    const connection={provider:"openai",connected_at:"2026-10-21T11:00:00Z",
      disconnected_at:null,last_success_at:null,last_error:null};
    const calculate=(connected_at:string)=>alertCandidates({portfolio:[],daily:[],
      contracts:new Map(),connections:[{...connection,connected_at}],reconciliation:[],
      settings:defaultAlertSettings,defaultTarget:"50",orgId:"org",asOf});
    expect(calculate(connection.connected_at)).toHaveLength(0);
    expect(calculate("2026-10-19T11:00:00Z")[0]?.kind).toBe("stale_data");
  });
});
