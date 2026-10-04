"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  return <><button className="button ghost" disabled={busy} onClick={async()=>{
    setBusy(true);setError("");
    const {error} = await browserSupabase().auth.signOut();
    setBusy(false);
    if(error){setError("Could not sign out. Try again.");return;}
    router.push("/sign-in"); router.refresh();
  }}>{busy?"Signing out…":"Sign out"}</button>{error&&<span className="small" role="alert">{error}</span>}</>;
}
