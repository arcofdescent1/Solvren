"use client";

import { useState } from "react";
import { AlertSettings, inQuietHours } from "@/lib/phase3-alerts";

export function AlertSettingsForm({orgId,initial}:{orgId:string;initial:AlertSettings}){
  const [value,setValue]=useState(initial);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const update=(patch:Partial<AlertSettings>)=>setValue((current)=>({...current,...patch}));
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      if(inQuietHours(value.digest_hour,value.quiet_start_hour,value.quiet_end_hour))
        throw new Error("Set the weekly digest hour outside quiet hours.");
      const response=await fetch(`/api/organizations/${orgId}/alert-settings`,{
        method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          floorExposureUsd:Number(value.floor_exposure_usd),
          projectedExposureUsd:Number(value.projected_exposure_usd),
          dailySpikePct:Number(value.daily_spike_pct),
          dailySpikeMinUsd:Number(value.daily_spike_min_usd),
          reconciliationGapUsd:Number(value.reconciliation_gap_usd),
          staleHours:Number(value.stale_hours),timezone:value.timezone,
          quietStartHour:Number(value.quiet_start_hour),quietEndHour:Number(value.quiet_end_hour),
          digestWeekday:Number(value.digest_weekday),digestHour:Number(value.digest_hour),
        })});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??"Could not save alert settings.");
      setMessage("Alert thresholds and delivery schedule saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Could not save settings.");}
    finally{setBusy(false);}
  }
  return <details className="card section"><summary className="table-link">Alert thresholds and delivery</summary>
    <p className="section">Alerts are deduplicated per contract and condition. A new email is sent when a condition first appears, recurs after clearing, or remains active when a snooze expires.</p>
    <form onSubmit={(event)=>void save(event)}><div className="grid">
      <label className="field">Observed floor exposure (USD)<input className="input" type="number" min="0" step="0.01" value={value.floor_exposure_usd} onChange={(e)=>update({floor_exposure_usd:e.target.value})}/></label>
      <label className="field">Projected floor exposure (USD)<input className="input" type="number" min="0" step="0.01" value={value.projected_exposure_usd} onChange={(e)=>update({projected_exposure_usd:e.target.value})}/></label>
      <label className="field">Daily spike % above prior seven-day average<input className="input" type="number" min="0" max="1000" step="0.01" value={value.daily_spike_pct} onChange={(e)=>update({daily_spike_pct:e.target.value})}/></label>
      <label className="field">Minimum daily spike increase (USD)<input className="input" type="number" min="0" step="0.01" value={value.daily_spike_min_usd} onChange={(e)=>update({daily_spike_min_usd:e.target.value})}/></label>
      <label className="field">Reconciliation gap (USD)<input className="input" type="number" min="0" step="0.01" value={value.reconciliation_gap_usd} onChange={(e)=>update({reconciliation_gap_usd:e.target.value})}/></label>
      <label className="field">Connection stale after hours<input className="input" type="number" min="1" max="168" value={value.stale_hours} onChange={(e)=>update({stale_hours:Number(e.target.value)})}/></label>
      <label className="field">IANA timezone<input className="input" value={value.timezone} onChange={(e)=>update({timezone:e.target.value})} placeholder="America/Denver"/></label>
      <label className="field">Quiet hours start (0–23)<input className="input" type="number" min="0" max="23" value={value.quiet_start_hour} onChange={(e)=>update({quiet_start_hour:Number(e.target.value)})}/></label>
      <label className="field">Quiet hours end (0–23)<input className="input" type="number" min="0" max="23" value={value.quiet_end_hour} onChange={(e)=>update({quiet_end_hour:Number(e.target.value)})}/></label>
      <label className="field">Weekly digest day<select className="select" value={value.digest_weekday} onChange={(e)=>update({digest_weekday:Number(e.target.value)})}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,index)=><option key={day} value={index}>{day}</option>)}</select></label>
      <label className="field">Weekly digest hour (0–23)<input className="input" type="number" min="0" max="23" value={value.digest_hour} onChange={(e)=>update({digest_hour:Number(e.target.value)})}/></label>
    </div><button className="button section" disabled={busy}>Save alert settings</button></form>
    {message&&<p className="message section" role="status">{message}</p>}
  </details>;
}
