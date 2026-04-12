import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authStateFromUser } from "@/lib/auth";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InternalEmployeeRole } from "./employeeRoles";

export const SOLVREN_EMAIL_SUFFIX = "@solvren.com";

export type { InternalEmployeeRole } from "./employeeRoles";

export type InternalEmployeeContext = {
  user: User;
  emailLower: string;
  employeeRole: InternalEmployeeRole;
  admin: SupabaseClient;
};

function parseEmployeeRole(v: string): InternalEmployeeRole | null {
  const r = v as InternalEmployeeRole;
  if (
    r === "support_admin" ||
    r === "billing_support" ||
    r === "account_ops" ||
    r === "technical_support" ||
    r === "super_admin"
  ) {
    return r;
  }
  return null;
}

export type InternalApiGate =
  | { ok: true; ctx: InternalEmployeeContext }
  | { ok: false; response: NextResponse };

/**
 * Internal API gate: 401 unauthenticated, 403 verified-but-ineligible (includes non-@solvren.com).
 * Creates a privileged Supabase client only after all checks pass.
 */
export async function requireInternalEmployeeApi(): Promise<InternalApiGate> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const state = authStateFromUser(user);
  if (!state.isVerified) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const emailLower = (user.email ?? "").toLowerCase();
  if (!emailLower.endsWith(SOLVREN_EMAIL_SUFFIX)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const admin = createPrivilegedClient("requireInternalEmployeeApi: internal employee gate");

  const { data: row, error } = await admin
    .from("internal_employee_accounts")
    .select("user_id, email, employee_role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const active = Boolean((row as { is_active?: boolean }).is_active);
  if (!active) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const employeeRole = parseEmployeeRole(String((row as { employee_role?: string }).employee_role ?? ""));
  if (!employeeRole) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const storedEmail = String((row as { email?: string }).email ?? "").toLowerCase();
  if (storedEmail !== emailLower) {
    await admin
      .from("internal_employee_accounts")
      .update({ email: emailLower, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  return {
    ok: true,
    ctx: { user, emailLower, employeeRole, admin },
  };
}

export type InternalPageGate =
  | { gate: "ok"; ctx: InternalEmployeeContext }
  | { gate: "login" }
  | { gate: "forbidden" };

/** Server components: unauthenticated → login; authenticated but not internal → forbidden (redirect to /dashboard). */
export async function getInternalPageGate(): Promise<InternalPageGate> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { gate: "login" };

  const state = authStateFromUser(user);
  if (!state.isVerified) return { gate: "forbidden" };

  const emailLower = (user.email ?? "").toLowerCase();
  if (!emailLower.endsWith(SOLVREN_EMAIL_SUFFIX)) return { gate: "forbidden" };

  const admin = createPrivilegedClient("getInternalPageGate: internal layout");

  const { data: row, error } = await admin
    .from("internal_employee_accounts")
    .select("user_id, email, employee_role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row || !Boolean((row as { is_active?: boolean }).is_active)) {
    return { gate: "forbidden" };
  }

  const employeeRole = parseEmployeeRole(String((row as { employee_role?: string }).employee_role ?? ""));
  if (!employeeRole) return { gate: "forbidden" };

  const storedEmail = String((row as { email?: string }).email ?? "").toLowerCase();
  if (storedEmail !== emailLower) {
    await admin
      .from("internal_employee_accounts")
      .update({ email: emailLower, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  return { gate: "ok", ctx: { user, emailLower, employeeRole, admin } };
}
