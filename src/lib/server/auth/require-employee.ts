/**
 * Phase 4 — employee identity from employee_profiles (single pool; no profile = no employee access).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeePhase4Role, EmployeeProfile, EmployeeProfileStatus } from "@/lib/server/employee/phase4EmployeeRoleMap";

export type { EmployeeProfile, EmployeePhase4Role } from "@/lib/server/employee/phase4EmployeeRoleMap";

function parsePhase4Role(raw: string): EmployeePhase4Role | null {
  const r = raw as EmployeePhase4Role;
  if (r === "SUPPORT" || r === "IMPLEMENTATION" || r === "ENGINEERING" || r === "SECURITY" || r === "ADMIN") {
    return r;
  }
  return null;
}

function parseStatus(raw: string): EmployeeProfileStatus | null {
  const s = raw as EmployeeProfileStatus;
  if (s === "active" || s === "suspended" || s === "terminated") return s;
  return null;
}

export async function getEmployeeProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<EmployeeProfile | null> {
  const { data, error } = await admin
    .from("employee_profiles")
    .select("id, user_id, email, role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const role = parsePhase4Role(String((data as { role?: string }).role ?? ""));
  const status = parseStatus(String((data as { status?: string }).status ?? ""));
  if (!role || !status) return null;

  return {
    id: String((data as { id: string }).id),
    userId: String((data as { user_id: string }).user_id),
    email: String((data as { email: string }).email).toLowerCase(),
    role,
    status,
  };
}

export async function requireEmployee(admin: SupabaseClient, userId: string): Promise<EmployeeProfile> {
  const employee = await getEmployeeProfile(admin, userId);
  if (!employee || employee.status !== "active") {
    throw new Error("Not an authorized Solvren employee");
  }
  return employee;
}
