import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { recordLogin } from "@/lib/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=missing-code", url.origin));
  const supabase = await serverSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/sign-in?error=auth-failed", url.origin));
  const {data:{user}}=await supabase.auth.getUser();
  if(user?.email_confirmed_at){try{await recordLogin(user.id);}catch{}}
  return NextResponse.redirect(new URL(next, url.origin));
}
