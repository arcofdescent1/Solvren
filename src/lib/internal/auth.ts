import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authStateFromUser } from "@/lib/auth";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEmployeeProfile } from "@/lib/server/auth/require-employee";
import type { EmployeeProfile } from "@/lib/server/employee/phase4EmployeeRoleMap";
import { phase4RoleToInternalEmployeeRole } from "@/lib/server/employee/phase4EmployeeRoleMap";
import type { InternalEmployeeRole } from "./employeeRoles";

export const SOLVREN_EMAIL_SUFFIX = "@solvren.com";

export type { InternalEmployeeRole } from "./employeeRoles";

export type InternalEmployeeContext = {
  user: User;
  emailLower: string;
  employeeRole: InternalEmployeeRole;
  phase4Profile: EmployeeProfile;
  admin: SupabaseClient;
};

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

  const phase4Profile = await getEmployeeProfile(admin, user.id);
  if (!phase4Profile || phase4Profile.status !== "active") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (phase4Profile.email !== emailLower) {
    await admin
      .from("employee_profiles")
      .update({ email: emailLower, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  const employeeRole = phase4RoleToInternalEmployeeRole(phase4Profile.role);

  return {
    ok: true,
    ctx: { user, emailLower, employeeRole, phase4Profile, admin },
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

  const phase4Profile = await getEmployeeProfile(admin, user.id);
  if (!phase4Profile || phase4Profile.status !== "active") {
    return { gate: "forbidden" };
  }

  if (phase4Profile.email !== emailLower) {
    await admin
      .from("employee_profiles")
      .update({ email: emailLower, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  const employeeRole = phase4RoleToInternalEmployeeRole(phase4Profile.role);

  return { gate: "ok", ctx: { user, emailLower, employeeRole, phase4Profile, admin } };
}
