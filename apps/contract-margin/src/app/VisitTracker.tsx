"use client";

import { useEffect,useState } from "react";

export function VisitTracker(){
  const [choice,setChoice]=useState<"accepted"|"declined"|null>(null);
  useEffect(()=>{
    const value=localStorage.getItem("solvren_analytics_consent");
    if(value==="accepted"||value==="declined")queueMicrotask(()=>setChoice(value));
    if(value==="accepted")void fetch("/api/analytics/visit",{method:"POST"});
  },[]);
  function choose(value:"accepted"|"declined"){
    localStorage.setItem("solvren_analytics_consent",value);setChoice(value);
    if(value==="accepted")void fetch("/api/analytics/visit",{method:"POST"});
  }
  if(choice!==null)return null;
  return <aside className="consent-bar" aria-label="Anonymous analytics choice"><div>
    <b>Help us measure the path to a first report?</b>
    <p>With your choice, Solvren stores a pseudonymous visit ID and product milestones. No customer names, contracts, prompts, or raw usage go into analytics. <a href="/privacy">Privacy details</a>.</p></div>
    <div className="inline-form"><button className="button" type="button" onClick={()=>choose("accepted")}>Allow metrics</button>
      <button className="button secondary" type="button" onClick={()=>choose("declined")}>No thanks</button></div></aside>;
}
