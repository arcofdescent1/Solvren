/**
 * Phase 2 §13 — Diagnostics notification retry + escalation resend against real
 * `notification_outbox` rows (service role), with `requireInternalEmployeeApi` mocked
 * so route handlers run in Vitest without browser cookies.
 *
 * Requires Supabase with migrations through internal portal + notification_outbox
 * (incl. `technical_support` on internal_employee_accounts).
 *
 * Env:
 *   RUN_INTEGRATION_TESTS=1
 *   INTERNAL_PORTAL_INTEGRATION=1  (extra gate: DB must include internal_employee_accounts + notification_outbox)
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_INTEGRATION_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: `npm run test:integration:internal-portal` (Vitest file filter).
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/internal/auth", () => ({
  SOLVREN_EMAIL_SUFFIX: "@solvren.com",
  requireInternalEmployeeApi: vi.fn(),
}));

import { requireInternalEmployeeApi, type InternalEmployeeContext } from "@/lib/internal/auth";
import { POST as postEscalationResend } from "./escalations/[escalationId]/resend/route";
import { POST as postNotificationRetry } from "./notifications/[notificationId]/retry/route";

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const portalIntegration = process.env.INTERNAL_PORTAL_INTEGRATION === "1";
const url =
  process.env.SUPABASE_INTEGRATION_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

function stubUser(id: string, email: string): User {
  return {
    id,
    email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
    identities: [],
  } as User;
}

describe.skipIf(!enabled || !url || !serviceKey || !portalIntegration)(
  "diagnostics retry / escalation resend (notification_outbox)",
  () => {
  const suffix = randomUUID().slice(0, 8);
  const empEmail = `diag-int-${suffix}@solvren.com`;
  const password = "IntegrationTestP@ssw0rd!";

  let admin: SupabaseClient;
  let orgId: string;
  let empUserId = "";
  let ctx: InternalEmployeeContext;

  beforeAll(async () => {
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email: empEmail,
      password,
      email_confirm: true,
    });
    if (cuErr || !created.user) throw cuErr ?? new Error("createUser internal employee");
    empUserId = created.user.id;

    orgId = randomUUID();
    const { error: orgErr } = await admin.from("organizations").insert({
      id: orgId,
      name: `Diagnostics integration org ${suffix}`,
      created_by: empUserId,
    });
    if (orgErr) throw orgErr;

    const { error: ieErr } = await admin.from("internal_employee_accounts").insert({
      user_id: empUserId,
      email: empEmail,
      employee_role: "technical_support",
      is_active: true,
    });
    if (ieErr) throw ieErr;

    ctx = {
      user: stubUser(empUserId, empEmail),
      emailLower: empEmail,
      employeeRole: "technical_support",
      admin,
    };

    vi.mocked(requireInternalEmployeeApi).mockResolvedValue({ ok: true, ctx });
  });

  afterAll(async () => {
    vi.mocked(requireInternalEmployeeApi).mockReset();
    if (!admin) return;
    try {
      await admin.from("internal_employee_accounts").delete().eq("user_id", empUserId);
    } catch {
      /* best effort */
    }
    try {
      if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    } catch {
      /* best effort */
    }
    try {
      if (empUserId) await admin.auth.admin.deleteUser(empUserId);
    } catch {
      /* best effort */
    }
  });

  it("POST retry enqueues a new PENDING outbox row from a FAILED fixture", async () => {
    const failedId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: failedId,
      org_id: orgId,
      change_event_id: null,
      channel: "EMAIL",
      template_key: "digest",
      payload: { hello: "world" },
      status: "FAILED",
      attempt_count: 3,
      dedupe_key: null,
      delivered_at: null,
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/notifications/${failedId}/retry`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test manual retry reason" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postNotificationRetry(req, { params: Promise.resolve({ orgId, notificationId: failedId }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; status?: string; deduped?: boolean };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("queued");
    expect(body.deduped).toBeUndefined();

    const minuteWindow = Math.floor(Date.now() / 60000);
    const dedupe = `manual-retry:${failedId}:EMAIL:${minuteWindow}`;
    const { data: child, error: qErr } = await admin
      .from("notification_outbox")
      .select("id, status, dedupe_key, payload")
      .eq("dedupe_key", dedupe)
      .maybeSingle();
    expect(qErr).toBeNull();
    expect(child).not.toBeNull();
    expect((child as { status: string }).status).toBe("PENDING");
    const pl = (child as { payload: Record<string, unknown> }).payload;
    expect(pl.retryOfNotificationId).toBe(failedId);
    expect(pl.requestedByEmployeeUserId).toBe(empUserId);
    expect(pl.requestedByEmployeeEmail).toBe(empEmail);
    expect(pl.hello).toBe("world");

    await admin.from("notification_outbox").delete().eq("id", failedId);
    await admin.from("notification_outbox").delete().eq("id", (child as { id: string }).id);
  });

  it("POST retry returns deduped when an equivalent retry is already pending", async () => {
    const failedId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: failedId,
      org_id: orgId,
      change_event_id: null,
      channel: "SLACK",
      template_key: "alert",
      payload: {},
      status: "FAILED",
      delivered_at: null,
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const minuteWindow = Math.floor(Date.now() / 60000);
    const dedupe = `manual-retry:${failedId}:SLACK:${minuteWindow}`;
    const { error: seedChildErr } = await admin.from("notification_outbox").insert({
      org_id: orgId,
      change_event_id: null,
      channel: "SLACK",
      template_key: "alert",
      payload: { retryOfNotificationId: failedId },
      status: "PENDING",
      attempt_count: 0,
      dedupe_key: dedupe,
      available_at: new Date().toISOString(),
    });
    expect(seedChildErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/notifications/${failedId}/retry`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test dedupe retry reason" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postNotificationRetry(req, { params: Promise.resolve({ orgId, notificationId: failedId }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; deduped?: boolean };
    expect(body.ok).toBe(true);
    expect(body.deduped).toBe(true);

    await admin.from("notification_outbox").delete().eq("dedupe_key", dedupe);
    await admin.from("notification_outbox").delete().eq("id", failedId);
  });

  it("POST retry returns 409 when source is not FAILED", async () => {
    const pendingId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: pendingId,
      org_id: orgId,
      change_event_id: null,
      channel: "EMAIL",
      template_key: "digest",
      payload: {},
      status: "SENT",
      sent_at: new Date().toISOString(),
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/notifications/${pendingId}/retry`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test not retryable path" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postNotificationRetry(req, { params: Promise.resolve({ orgId, notificationId: pendingId }) });
    expect(res.status).toBe(409);

    await admin.from("notification_outbox").delete().eq("id", pendingId);
  });

  it("POST escalation resend enqueues a new row for escalation template (no change_event)", async () => {
    const escId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: escId,
      org_id: orgId,
      change_event_id: null,
      channel: "EMAIL",
      template_key: "escalation",
      payload: { escalationKind: "sla_overdue" },
      status: "FAILED",
      delivered_at: null,
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/escalations/${escId}/resend`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test escalation resend reason" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postEscalationResend(req, { params: Promise.resolve({ orgId, escalationId: escId }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; deduped?: boolean };
    expect(body.ok).toBe(true);
    expect(body.deduped).toBeUndefined();

    const minuteWindow = Math.floor(Date.now() / 60000);
    const dedupe = `escalation-resend:${escId}:${minuteWindow}`;
    const { data: child, error: qErr } = await admin
      .from("notification_outbox")
      .select("id, payload, template_key")
      .eq("dedupe_key", dedupe)
      .maybeSingle();
    expect(qErr).toBeNull();
    expect(child).not.toBeNull();
    expect((child as { template_key: string }).template_key).toBe("escalation");
    const pl = (child as { payload: Record<string, unknown> }).payload;
    expect(pl.resendOfOutboxId).toBe(escId);
    expect(pl.escalationKind).toBe("sla_overdue");

    await admin.from("notification_outbox").delete().eq("id", escId);
    await admin.from("notification_outbox").delete().eq("id", (child as { id: string }).id);
  });

  it("POST escalation resend returns deduped when pending row exists for dedupe key", async () => {
    const escId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: escId,
      org_id: orgId,
      change_event_id: null,
      channel: "EMAIL",
      template_key: "escalation",
      payload: {},
      status: "FAILED",
      delivered_at: null,
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const minuteWindow = Math.floor(Date.now() / 60000);
    const dedupe = `escalation-resend:${escId}:${minuteWindow}`;
    const { error: seedErr } = await admin.from("notification_outbox").insert({
      org_id: orgId,
      change_event_id: null,
      channel: "EMAIL",
      template_key: "escalation",
      payload: { resendOfOutboxId: escId },
      status: "QUEUED",
      attempt_count: 0,
      dedupe_key: dedupe,
      available_at: new Date().toISOString(),
    });
    expect(seedErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/escalations/${escId}/resend`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test escalation dedupe reason" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postEscalationResend(req, { params: Promise.resolve({ orgId, escalationId: escId }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; deduped?: boolean };
    expect(body.ok).toBe(true);
    expect(body.deduped).toBe(true);

    await admin.from("notification_outbox").delete().eq("dedupe_key", dedupe);
    await admin.from("notification_outbox").delete().eq("id", escId);
  });

  it("POST escalation resend returns 409 for non-escalation template_key", async () => {
    const rowId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: rowId,
      org_id: orgId,
      change_event_id: null,
      channel: "EMAIL",
      template_key: "digest",
      payload: {},
      status: "FAILED",
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/escalations/${rowId}/resend`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test wrong template resend" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postEscalationResend(req, { params: Promise.resolve({ orgId, escalationId: rowId }) });
    expect(res.status).toBe(409);

    await admin.from("notification_outbox").delete().eq("id", rowId);
  });

  it("POST escalation resend returns 409 when linked change is not active for escalation", async () => {
    const changeId = randomUUID();
    const { error: ceErr } = await admin.from("change_events").insert({
      id: changeId,
      org_id: orgId,
      title: "integration escalation gate",
      change_type: "OTHER",
      status: "DRAFT",
      intake: {},
      systems_involved: [],
      revenue_impact_areas: [],
      created_by: empUserId,
    });
    expect(ceErr).toBeNull();

    const escId = randomUUID();
    const { error: insErr } = await admin.from("notification_outbox").insert({
      id: escId,
      org_id: orgId,
      change_event_id: changeId,
      channel: "EMAIL",
      template_key: "escalation",
      payload: {},
      status: "FAILED",
      delivered_at: null,
      available_at: new Date().toISOString(),
    });
    expect(insErr).toBeNull();

    const req = new NextRequest(`http://localhost/api/internal/accounts/${orgId}/diagnostics/escalations/${escId}/resend`, {
      method: "POST",
      body: JSON.stringify({ reason: "integration test inactive change reason" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postEscalationResend(req, { params: Promise.resolve({ orgId, escalationId: escId }) });
    expect(res.status).toBe(409);

    await admin.from("notification_outbox").delete().eq("id", escId);
    await admin.from("change_events").delete().eq("id", changeId);
  });
});
