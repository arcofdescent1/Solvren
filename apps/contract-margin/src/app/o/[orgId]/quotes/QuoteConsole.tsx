"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuoteScenario, WorkflowSample } from "@/lib/quote-finance";
import { usd } from "@/lib/finance";

type Saved = { id:string; quote_id:string; version:number; customer_name:string;
  owner_user_id:string; decision:string; notes:string; scenario_input:unknown };
type Result = { label:string; confidence:string; workflowEvidence:Array<{workflowId:string;sampleSize:number;basis:string}>;
  median:{revenueUsd:string;costUsd:string;contributionUsd:string;marginPct:string|null};
  adverse:{revenueUsd:string;costUsd:string;contributionUsd:string;marginPct:string|null};
  breakevenOutcomes:string|null; requiredBaseFeeUsd:string|null; maximumIncludedOutcomes:string|null;
  recommendation:string };

function blank(workflowId:string,target:number):QuoteScenario {
  return { label:"Base proposal",monthlyOutcomes:100,proposedFeeUsd:"5000",discountPct:0,
    includedOutcomes:100,overageUsd:"0",volumeStressPct:25,targetMarginPct:target,
    mix:[{workflowId,sharePct:100,manualMedianUsd:null,manualAdverseUsd:null}] };
}

export function QuoteConsole({orgId,defaultTarget,samples,members,saved}:{
  orgId:string;defaultTarget:string;samples:WorkflowSample[];
  members:Array<{user_id:string;email:string}>;saved:Saved[];
}) {
  const router = useRouter();
  const workflow = samples[0]?.workflow_id ?? "";
  const [scenarios,setScenarios] = useState<QuoteScenario[]>([blank(workflow,Number(defaultTarget))]);
  const [quoteId,setQuoteId] = useState<string|null>(null);
  const [customerName,setCustomerName] = useState("");
  const [ownerUserId,setOwnerUserId] = useState(members[0]?.user_id ?? "");
  const [decision,setDecision] = useState<"approve"|"revise"|"reject">("revise");
  const [notes,setNotes] = useState("");
  const [results,setResults] = useState<Result[]>([]);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const update = (index:number,patch:Partial<QuoteScenario>) => setScenarios((current) =>
    current.map((scenario,i) => i === index ? {...scenario,...patch} : scenario));
  const updateMix = (index:number,lineIndex:number,patch:Partial<QuoteScenario["mix"][number]>) =>
    setScenarios((current) => current.map((scenario,i) => i === index ? {...scenario,
      mix:scenario.mix.map((line,j) => j === lineIndex ? {...line,...patch} : line)} : scenario));
  function loadSaved(id:string) {
    const found = saved.find((item) => item.id === id);
    if (!found) return;
    setQuoteId(found.quote_id);setCustomerName(found.customer_name);
    setOwnerUserId(found.owner_user_id);setDecision(found.decision as typeof decision);
    setNotes(found.notes);setScenarios(found.scenario_input as QuoteScenario[]);
    setResults([]);setMessage(`Loaded version ${found.version}. Saving creates a new immutable version.`);
  }
  async function submit(save:boolean) {
    setBusy(true);setMessage("");
    try {
      const response = await fetch(`/api/organizations/${orgId}/quotes${save ? "" : "/preview"}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(save ? {quoteId,customerName,ownerUserId,decision,notes,scenarios} : {scenarios}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Quote review failed.");
      setResults(body.results as Result[]);
      if (save) {setQuoteId(body.quoteId);setMessage(`Decision saved as version ${body.version}.`);router.refresh();}
      else setMessage("Scenario comparison updated from current evidence. Save a decision to freeze it.");
    } catch(error) {setMessage(error instanceof Error ? error.message : "Quote review failed.");}
    finally {setBusy(false);}
  }
  return <><section className="card"><div className="section-heading"><div><h2>Compare proposals</h2><p>Up to three scenarios. Workflow shares must total 100% in each. A sample below 30 priced completed runs requires manual median and adverse unit costs.</p></div></div>
    <div className="grid"><label className="field">Customer or prospect<input className="input" value={customerName} maxLength={200} onChange={(e)=>setCustomerName(e.target.value)}/></label>
      <label className="field">Decision owner<select className="select" value={ownerUserId} onChange={(e)=>setOwnerUserId(e.target.value)}>{members.map((item)=><option key={item.user_id} value={item.user_id}>{item.email}</option>)}</select></label></div>
    <div className="inline-form"><label className="field">Continue an earlier quote<select className="select" value="" onChange={(e)=>loadSaved(e.target.value)}><option value="">New quote</option>{saved.map((item)=><option key={item.id} value={item.id}>{item.customer_name} · v{item.version} · {item.decision}</option>)}</select></label>
      <button className="button secondary" type="button" onClick={()=>{setQuoteId(null);setCustomerName("");setResults([]);setScenarios([blank(workflow,Number(defaultTarget))]);setMessage("New quote started.");}}>Start new</button></div>
    {scenarios.map((scenario,index)=><div className="import-tile section" key={index}><div className="section-heading"><h3>Scenario {index+1}</h3>{scenarios.length>1&&<button className="button ghost" type="button" onClick={()=>setScenarios(scenarios.filter((_,i)=>i!==index))}>Remove</button>}</div>
      <div className="grid"><label className="field">Name<input className="input" value={scenario.label} onChange={(e)=>update(index,{label:e.target.value})}/></label>
        <label className="field">Expected completed outcomes / month<input className="input" type="number" min="1" value={scenario.monthlyOutcomes} onChange={(e)=>update(index,{monthlyOutcomes:Number(e.target.value)})}/></label>
        <label className="field">Proposed monthly base fee (USD)<input className="input" type="number" min="0" step="0.01" value={scenario.proposedFeeUsd} onChange={(e)=>update(index,{proposedFeeUsd:e.target.value})}/></label>
        <label className="field">Discount %<input className="input" type="number" min="0" max="100" value={scenario.discountPct} onChange={(e)=>update(index,{discountPct:Number(e.target.value)})}/></label>
        <label className="field">Included outcomes / month<input className="input" type="number" min="0" value={scenario.includedOutcomes} onChange={(e)=>update(index,{includedOutcomes:Number(e.target.value)})}/></label>
        <label className="field">Overage per outcome (USD)<input className="input" type="number" min="0" step="0.01" value={scenario.overageUsd} onChange={(e)=>update(index,{overageUsd:e.target.value})}/></label>
        <label className="field">Adverse volume stress %<input className="input" type="number" min="0" max="200" value={scenario.volumeStressPct} onChange={(e)=>update(index,{volumeStressPct:Number(e.target.value)})}/></label>
        <label className="field">Target contribution margin %<input className="input" type="number" min="0" max="95" value={scenario.targetMarginPct} onChange={(e)=>update(index,{targetMarginPct:Number(e.target.value)})}/></label></div>
      <h3 className="section">Workflow mix</h3>{scenario.mix.map((line,lineIndex)=>{
        const sample = samples.find((item)=>item.workflow_id===line.workflowId);
        return <div className="import-tile" key={lineIndex}><div className="grid"><label className="field">Workflow<input className="input" list="quote-workflows" value={line.workflowId} onChange={(e)=>updateMix(index,lineIndex,{workflowId:e.target.value})}/></label>
          <label className="field">Share %<input className="input" type="number" min="0" max="100" step="0.01" value={line.sharePct} onChange={(e)=>updateMix(index,lineIndex,{sharePct:Number(e.target.value)})}/></label>
          <label className="field">Manual median / outcome (USD)<input className="input" type="number" min="0" step="0.000001" value={line.manualMedianUsd??""} onChange={(e)=>updateMix(index,lineIndex,{manualMedianUsd:e.target.value||null})}/></label>
          <label className="field">Manual adverse / outcome (USD)<input className="input" type="number" min="0" step="0.000001" value={line.manualAdverseUsd??""} onChange={(e)=>updateMix(index,lineIndex,{manualAdverseUsd:e.target.value||null})}/></label></div>
          <p className="small">{sample ? `${sample.priced_runs} priced completed runs · median ${sample.median_unit_usd === null ? "unavailable" : usd(sample.median_unit_usd)} · p90 ${sample.p90_unit_usd === null ? "unavailable" : usd(sample.p90_unit_usd)} · ${sample.unknown_runs} runs with unknown cost` : "No observed sample. Both manual assumptions are required."}</p>
          {scenario.mix.length>1&&<button className="button ghost" type="button" onClick={()=>update(index,{mix:scenario.mix.filter((_,i)=>i!==lineIndex)})}>Remove workflow</button>}</div>;
      })}<button className="button secondary section" type="button" disabled={scenario.mix.length>=5} onClick={()=>update(index,{mix:[...scenario.mix,{workflowId:"",sharePct:0,manualMedianUsd:null,manualAdverseUsd:null}]})}>Add workflow</button></div>)}
    <datalist id="quote-workflows">{samples.map((item)=><option key={item.workflow_id} value={item.workflow_id}/>)}</datalist>
    <button className="button secondary section" type="button" disabled={scenarios.length>=3} onClick={()=>setScenarios([...scenarios,{...blank(workflow,Number(defaultTarget)),label:`Option ${scenarios.length+1}` }])}>Add scenario</button>
    <div className="inline-form section"><button className="button secondary" type="button" disabled={busy} onClick={()=>void submit(false)}>Calculate comparison</button></div>
    {results.length>0&&<div className="import-grid section" aria-live="polite">{results.map((result)=><article className="import-tile" key={result.label}><h3>{result.label}</h3><span className={`pill ${Number(result.adverse.marginPct??0)<Number(scenarios.find((item)=>item.label===result.label)?.targetMarginPct??0)?"risk":""}`}>{result.confidence.replaceAll("_"," ")}</span>
      <div className="row"><span>Median</span><b>{usd(result.median.contributionUsd)} · {result.median.marginPct??"n/a"}%</b></div>
      <div className="row"><span>Adverse</span><b>{usd(result.adverse.contributionUsd)} · {result.adverse.marginPct??"n/a"}%</b></div>
      <p className="small">Median revenue {usd(result.median.revenueUsd)}, cost {usd(result.median.costUsd)}. Adverse revenue {usd(result.adverse.revenueUsd)}, cost {usd(result.adverse.costUsd)}.</p>
      <p className="small">Median breakeven volume: {result.breakevenOutcomes??"no finite breach under these terms"}. Required base fee: {result.requiredBaseFeeUsd===null?"unavailable at 100% discount":usd(result.requiredBaseFeeUsd)}. Allowable included outcomes: {result.maximumIncludedOutcomes??"no allowance change suffices"}.</p>
      <p>{result.recommendation}</p></article>)}</div>}
    <div className="grid section"><label className="field">Decision<select className="select" value={decision} onChange={(e)=>setDecision(e.target.value as typeof decision)}><option value="approve">Approve</option><option value="revise">Revise</option><option value="reject">Reject</option></select></label>
      <label className="field">Decision notes<textarea className="input" rows={3} maxLength={4000} value={notes} onChange={(e)=>setNotes(e.target.value)}/></label></div>
    <button className="button" type="button" disabled={busy} onClick={()=>void submit(true)}>Save immutable decision</button>
    {message&&<p className="message section" role="status">{message}</p>}
  </section></>;
}
