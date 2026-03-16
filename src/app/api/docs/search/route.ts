import { NextResponse } from "next/server";
import { searchDocs } from "@/lib/docs/searchDocs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });
  const results = searchDocs(q);
  return NextResponse.json({ results });
}
