/**
 * Pass 7 — Search service: standardized scope, ranking, visibility.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterVisibleChanges } from "@/lib/access/changeAccess";

export type SearchIssue = {
  id: string;
  type: "issue";
  title: string;
  subtitle: string;
  href: string;
  matchContext?: string;
  issueKey: string;
  sourceType: string;
  domainKey: string;
  severity: string;
  status: string;
  verificationStatus: string;
};

export type SearchResultGroup = {
  changes: SearchChange[];
  issues: SearchIssue[];
  systems: SearchSystem[];
  approvals: SearchApproval[];
  evidence: SearchEvidence[];
  users: SearchUser[];
};

export type SearchChange = {
  id: string;
  type: "change";
  title: string;
  subtitle: string;
  href: string;
  matchContext?: string;
  status: string | null;
  domain: string | null;
  change_type: string | null;
  systems_involved: string[];
  submitted_at: string | null;
};

export type SearchSystem = {
  id: string;
  type: "system";
  title: string;
  subtitle: string;
  href: string;
  matchContext?: string;
};

export type SearchApproval = {
  id: string;
  type: "approval";
  title: string;
  subtitle: string;
  href: string;
  matchContext?: string;
  decision: string;
  approval_area: string;
  change_title: string | null;
};

export type SearchEvidence = {
  id: string;
  type: "evidence";
  title: string;
  subtitle: string;
  href: string;
  matchContext?: string;
  kind: string;
  label: string;
  change_title: string | null;
};

export type SearchUser = {
  id: string;
  type: "user";
  title: string;
  subtitle: string;
  href: string;
  matchContext?: string;
  email: string;
  display_name: string;
};

export type SearchParams = {
  q: string;
  limit: number;
  page: number;
  entityTypes: string[];
  status?: string;
  system?: string;
  changeType?: string;
  domain?: string;
};

function toChangeResult(
  r: { id: string; title: string | null; status: string | null; change_type: string | null; domain: string | null; systems_involved: string[]; submitted_at: string | null },
  query: string
): SearchChange {
  const title = r.title ?? r.id;
  const matchContext = query
    ? [r.status, r.change_type, r.domain, (r.systems_involved ?? [])[0]].filter(Boolean).join(" · ")
    : undefined;
  return {
    id: r.id,
    type: "change",
    title,
    subtitle: matchContext ?? "",
    href: `/changes/${r.id}`,
    matchContext,
    status: r.status,
    domain: r.domain,
    change_type: r.change_type,
    systems_involved: r.systems_involved ?? [],
    submitted_at: r.submitted_at,
  };
}

export async function executeSearch(
  supabase: SupabaseClient,
  userId: string,
  orgIds: string[],
  params: SearchParams
): Promise<SearchResultGroup> {
  const { q, limit, page, entityTypes, status, system, changeType, domain } = params;
  const offset = (page - 1) * limit;
  const safeQ = q.replace(/'/g, "''");
  const pattern = `%${safeQ}%`;

  const result: SearchResultGroup = {
    changes: [],
    issues: [],
    systems: [],
    approvals: [],
    evidence: [],
    users: [],
  };

  if (!orgIds.length || q.length < 2) return result;

  const accessibleChangeIds = new Set<string>();

  // Issues (Phase 0): org-scoped, ILIKE on title/summary/description/issue_key/source_type/domain_key
  if (entityTypes.includes("issues")) {
    const orClause = [
      `title.ilike.%${safeQ}%`,
      `summary.ilike.%${safeQ}%`,
      `description.ilike.%${safeQ}%`,
      `issue_key.ilike.%${safeQ}%`,
      `source_type.ilike.%${safeQ}%`,
      `domain_key.ilike.%${safeQ}%`,
    ].join(",");
    const { data: issueRows } = await supabase
      .from("issues")
      .select("id, issue_key, title, summary, source_type, domain_key, severity, status, verification_status")
      .in("org_id", orgIds)
      .or(orClause)
      .order("opened_at", { ascending: false })
      .range(offset, offset + limit - 1);
    for (const r of issueRows ?? []) {
      const status = r.status ?? "";
      const severity = r.severity ?? "";
      const sourceType = r.source_type ?? "";
      const domainKey = r.domain_key ?? "";
      const verificationStatus = r.verification_status ?? "";
      const issueKey = r.issue_key ?? "";
      const matchContext = [status, severity, sourceType, domainKey].filter(Boolean).join(" · ");
      result.issues.push({
        id: r.id,
        type: "issue",
        title: r.title ?? issueKey,
        subtitle: matchContext || issueKey,
        href: `/issues/${r.id}`,
        matchContext: matchContext || undefined,
        issueKey,
        sourceType,
        domainKey,
        severity,
        status,
        verificationStatus,
      });
    }
  }


  async function addAccessible(changeIds: string[]) {
    const deduped = [...new Set(changeIds.filter(Boolean))];
    if (deduped.length === 0) return;
    const { data: rows } = await supabase
      .from("change_events")
      .select("id, org_id, domain, status, created_by, is_restricted")
      .in("id", deduped);
    const visible = await filterVisibleChanges(supabase, userId, rows ?? []);
    for (const r of visible) accessibleChangeIds.add(r.id);
  }

  // Changes: try FTS first, fallback to ILIKE
  if (entityTypes.includes("changes")) {
    let changeRows: Array<{ id: string; title: string | null; status: string | null; change_type: string | null; domain: string | null; systems_involved: string[]; submitted_at: string | null }> = [];

    let ftsData: { change_id: string }[] | null = null;
    try {
      const { data } = await supabase.rpc("search_changes_fts", {
        p_org_ids: orgIds,
        p_query: q,
        p_limit: limit + 50,
      });
      ftsData = data;
    } catch {
      // FTS RPC may not exist (migration 113 not applied); fall back to ilike
    }

    if (ftsData?.length) {
      const rankedIds = (ftsData as { change_id: string }[]).map((r) => r.change_id);
      const { data: full } = await supabase
        .from("change_events")
        .select("id, title, status, change_type, structured_change_type, domain, systems_involved, submitted_at, org_id, is_restricted, created_by")
        .in("id", rankedIds);

      const fullRows = full ?? [];
      const visible = await filterVisibleChanges(supabase, userId, fullRows);
      for (const r of visible) accessibleChangeIds.add(r.id);

      const order = new Map(rankedIds.map((id, i) => [id, i]));
      visible.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
      changeRows = visible.slice(offset, offset + limit).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        change_type: (r as { structured_change_type?: string }).structured_change_type ?? (r as { change_type?: string }).change_type ?? null,
        domain: r.domain,
        systems_involved: (r as { systems_involved?: string[] }).systems_involved ?? [],
        submitted_at: (r as { submitted_at?: string }).submitted_at ?? null,
      }));
    } else {
      const orClause = [
        `title.ilike.%${safeQ}%`,
        `change_type.ilike.%${safeQ}%`,
        `structured_change_type.ilike.%${safeQ}%`,
        `domain.ilike.%${safeQ}%`,
      ].join(",");
      let query = supabase
        .from("change_events")
        .select("id, title, status, change_type, structured_change_type, domain, systems_involved, submitted_at, org_id, created_by, is_restricted")
        .in("org_id", orgIds)
        .or(orClause)
        .order("submitted_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) query = query.eq("status", status);
      if (domain) query = query.eq("domain", domain);
      if (changeType) query = query.or(`change_type.eq.${changeType},structured_change_type.eq.${changeType}`);

      const { data: rows } = await query;
      let list = rows ?? [];
      if (system) list = list.filter((r) => (r.systems_involved ?? []).includes(system));
      list = await filterVisibleChanges(supabase, userId, list);
      for (const r of list) accessibleChangeIds.add(r.id);
      changeRows = list.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        change_type: (r as { structured_change_type?: string }).structured_change_type ?? r.change_type ?? null,
        domain: r.domain,
        systems_involved: (r.systems_involved ?? []) as string[],
        submitted_at: r.submitted_at,
      }));
    }

    result.changes = changeRows.map((r) => toChangeResult(r, q));
  }

  // Systems
  if (entityTypes.includes("systems")) {
    const { data: changeRows } = await supabase
      .from("change_events")
      .select("id, org_id, domain, status, created_by, is_restricted, systems_involved")
      .in("org_id", orgIds);
    const visible = await filterVisibleChanges(supabase, userId, changeRows ?? []);
    const allSystems = new Set<string>();
    for (const r of visible) {
      for (const s of r.systems_involved ?? []) {
        if (String(s).toLowerCase().includes(q.toLowerCase())) allSystems.add(String(s));
      }
    }
    result.systems = [...allSystems].slice(0, 10).map((s) => ({
      id: s,
      type: "system" as const,
      title: s,
      subtitle: "System",
      href: `/search?q=${encodeURIComponent(s)}&system=${encodeURIComponent(s)}`,
      matchContext: s,
    }));
  }

  // Approvals
  if (entityTypes.includes("approvals")) {
    const { data: apprRows } = await supabase
      .from("approvals")
      .select("id, change_event_id, approval_area, decision, approver_user_id")
      .in("org_id", orgIds)
      .ilike("approval_area", pattern)
      .limit(limit);
    if (apprRows?.length) {
      await addAccessible(apprRows.map((a) => a.change_event_id));
      const changeIds = [...new Set(apprRows.map((a) => a.change_event_id))];
      const { data: chData } = await supabase.from("change_events").select("id, title").in("id", changeIds);
      const titleByChange = new Map((chData ?? []).map((c) => [c.id, c.title]));
      for (const a of apprRows) {
        if (!accessibleChangeIds.has(a.change_event_id)) continue;
        const changeTitle = titleByChange.get(a.change_event_id) ?? a.change_event_id;
        result.approvals.push({
          id: a.id,
          type: "approval",
          title: `${a.approval_area} – ${changeTitle}`,
          subtitle: a.decision,
          href: `/changes/${a.change_event_id}`,
          matchContext: a.approval_area,
          decision: a.decision,
          approval_area: a.approval_area,
          change_title: changeTitle,
        });
      }
    }
    if (result.approvals.length === 0) {
      const { data: chRows } = await supabase
        .from("change_events")
        .select("id, title")
        .in("org_id", orgIds)
        .ilike("title", pattern)
        .limit(limit);
      const changeIds = (chRows ?? []).map((c) => c.id);
      if (changeIds.length) {
        await addAccessible(changeIds);
        const { data: apprData } = await supabase
          .from("approvals")
          .select("id, change_event_id, approval_area, decision, approver_user_id")
          .in("change_event_id", changeIds)
          .limit(limit);
        const titleByChange = new Map((chRows ?? []).map((c) => [c.id, c.title]));
        for (const a of apprData ?? []) {
          if (!accessibleChangeIds.has(a.change_event_id)) continue;
          const changeTitle = titleByChange.get(a.change_event_id) ?? a.change_event_id;
          result.approvals.push({
            id: a.id,
            type: "approval",
            title: `${a.approval_area} – ${changeTitle}`,
            subtitle: a.decision,
            href: `/changes/${a.change_event_id}`,
            matchContext: a.approval_area,
            decision: a.decision,
            approval_area: a.approval_area,
            change_title: changeTitle,
          });
        }
      }
    }
  }

  // Evidence
  if (entityTypes.includes("evidence")) {
    const evOr = `kind.ilike.%${safeQ}%,label.ilike.%${safeQ}%`;
    const { data: evRows } = await supabase
      .from("change_evidence")
      .select("id, change_event_id, kind, label, url, note")
      .in("org_id", orgIds)
      .or(evOr)
      .limit(limit);
    if (evRows?.length) {
      await addAccessible(evRows.map((e) => e.change_event_id));
      const changeIds = [...new Set(evRows.map((e) => e.change_event_id))];
      const { data: chData } = await supabase.from("change_events").select("id, title").in("id", changeIds);
      const titleByChange = new Map((chData ?? []).map((c) => [c.id, c.title]));
      for (const e of evRows) {
        if (!accessibleChangeIds.has(e.change_event_id)) continue;
        result.evidence.push({
          id: e.id,
          type: "evidence",
          title: e.label || e.kind,
          subtitle: (titleByChange.get(e.change_event_id) ?? e.change_event_id) + " · " + e.kind,
          href: `/changes/${e.change_event_id}`,
          matchContext: e.kind,
          kind: e.kind,
          label: e.label,
          change_title: titleByChange.get(e.change_event_id) ?? null,
        });
      }
    }
    const { data: orgChangeIds } = await supabase.from("change_events").select("id").in("org_id", orgIds).limit(500);
    const cids = (orgChangeIds ?? []).map((c) => c.id);
    if (cids.length && result.evidence.length < limit) {
      const itemOr = `kind.ilike.%${safeQ}%,label.ilike.%${safeQ}%`;
      const { data: itemRows } = await supabase
        .from("change_evidence_items")
        .select("id, change_event_id, kind, label")
        .in("change_event_id", cids)
        .or(itemOr)
        .limit(limit);
      if (itemRows?.length) {
        await addAccessible(itemRows.map((i) => i.change_event_id));
        const changeIds = [...new Set(itemRows.map((i) => i.change_event_id))];
        const { data: chData } = await supabase.from("change_events").select("id, title").in("id", changeIds);
        const titleByChange = new Map((chData ?? []).map((c) => [c.id, c.title]));
        for (const i of itemRows) {
          if (result.evidence.length >= limit) break;
          if (!accessibleChangeIds.has(i.change_event_id)) continue;
          result.evidence.push({
            id: i.id,
            type: "evidence",
            title: i.label || i.kind,
            subtitle: (titleByChange.get(i.change_event_id) ?? i.change_event_id) + " · " + i.kind,
            href: `/changes/${i.change_event_id}`,
            matchContext: i.kind,
            kind: i.kind,
            label: i.label,
            change_title: titleByChange.get(i.change_event_id) ?? null,
          });
        }
      }
    }
  }

  // Users (admin workflows)
  if (entityTypes.includes("users")) {
    let userRows: unknown = null;
    try {
      const { data } = await supabase.rpc("search_org_users", {
        p_org_ids: orgIds,
        p_query: q,
        p_limit: limit,
      });
      userRows = data;
    } catch {
      // RPC may not exist (migration 113 not applied)
    }
    const users = (userRows ?? []) as Array<{ user_id: string; email: string; display_name: string }>;
    result.users = users.map((u) => ({
      id: u.user_id,
      type: "user" as const,
      title: u.display_name || u.email,
      subtitle: u.email,
      href: `/settings/users`,
      matchContext: u.email,
      email: u.email,
      display_name: u.display_name,
    }));
  }

  return result;
}
