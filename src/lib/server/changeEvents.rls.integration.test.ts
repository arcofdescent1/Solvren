/**
 * Two-org RLS smoke: user in org A cannot read a change_event row in org B.
 *
 * Requires local or CI Supabase with migrations applied (incl. change_events RLS).
 *
 * Env:
 *   RUN_INTEGRATION_TESTS=1
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_INTEGRATION_URL)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const url =
  process.env.SUPABASE_INTEGRATION_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

describe.skipIf(!enabled || !url || !anonKey || !serviceKey)("change_events RLS (two orgs)", () => {
  const suffix = randomUUID().slice(0, 8);
  const emailA = `rls-a-${suffix}@example.com`;
  const emailB = `rls-b-${suffix}@example.com`;
  const password = "IntegrationTestP@ssw0rd!";

  let admin: SupabaseClient;
  let orgA: string;
  let orgB: string;
  let userAId = "";
  let userBId = "";
  let changeId = "";

  beforeAll(async () => {
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ua, error: eUa } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const { data: ub, error: eUb } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (eUa || !ua.user) throw eUa ?? new Error("createUser A");
    if (eUb || !ub.user) throw eUb ?? new Error("createUser B");
    userAId = ua.user.id;
    userBId = ub.user.id;

    orgA = randomUUID();
    orgB = randomUUID();

    const { error: oaErr } = await admin
      .from("organizations")
      .insert({ id: orgA, name: `RLS Org A ${suffix}`, created_by: userAId });
    if (oaErr) throw oaErr;
    const { error: obErr } = await admin
      .from("organizations")
      .insert({ id: orgB, name: `RLS Org B ${suffix}`, created_by: userBId });
    if (obErr) throw obErr;

    const { error: maErr } = await admin.from("organization_members").insert({
      org_id: orgA,
      user_id: userAId,
      role: "admin",
    });
    if (maErr) throw maErr;

    const { error: mbErr } = await admin.from("organization_members").insert({
      org_id: orgB,
      user_id: ub.user!.id,
      role: "admin",
    });
    if (mbErr) throw mbErr;

    changeId = randomUUID();
    const { error: cErr } = await admin.from("change_events").insert({
      id: changeId,
      org_id: orgB,
      title: "RLS test change",
      change_type: "OTHER",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: [],
      revenue_impact_areas: [],
      intake: {},
      created_by: userBId,
    });
    if (cErr) throw cErr;
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await admin.from("change_events").delete().eq("id", changeId);
    } catch {
      /* best effort */
    }
    try {
      await admin.from("organization_members").delete().eq("org_id", orgA);
      await admin.from("organization_members").delete().eq("org_id", orgB);
      await admin.from("organizations").delete().eq("id", orgA);
      await admin.from("organizations").delete().eq("id", orgB);
    } catch {
      /* best effort */
    }
    try {
      await admin.auth.admin.deleteUser(userAId);
    } catch {
      /* best effort */
    }
    try {
      if (userBId) await admin.auth.admin.deleteUser(userBId);
    } catch {
      /* best effort */
    }
  });

  it("member of org A cannot select change_event in org B", async () => {
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await userClient.auth.signInWithPassword({ email: emailA, password });
    expect(signErr).toBeNull();

    const { data, error } = await userClient.from("change_events").select("id").eq("id", changeId).maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
