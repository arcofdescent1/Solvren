import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "org";
}

function extractPrimaryDomain(website: string | null | undefined): string | null {
  if (!website || typeof website !== "string") return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Create organization for authenticated, verified user.
 * Enterprise: accepts name, optional website, company_size, industry.
 * Uses service role to bypass RLS.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;
  const userId = userRes.user.id;

  let body: {
    name?: string;
    website?: string | null;
    companySize?: string | null;
    industry?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  const website =
    typeof body?.website === "string" && body.website.trim()
      ? body.website.trim()
      : null;
  const companySize =
    typeof body?.companySize === "string" && body.companySize.trim()
      ? body.companySize.trim()
      : null;
  const industry =
    typeof body?.industry === "string" && body.industry.trim()
      ? body.industry.trim()
      : null;
  const primaryDomain = extractPrimaryDomain(website);

  const baseSlug = slugify(name);
  const admin = createAdminClient();

  // Ensure unique slug
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (!existing) break;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name,
      slug,
      website: website ?? null,
      primary_domain: primaryDomain ?? null,
      company_size: companySize ?? null,
      industry: industry ?? null,
      created_by: userId,
    })
    .select()
    .single();

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  const { error: memErr } = await admin
    .from("organization_members")
    .insert({ org_id: org.id, user_id: userId, role: "owner" });

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, org });
}
