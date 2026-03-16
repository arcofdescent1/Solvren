import { GET as listGET } from "../list/route";

// Phase 3 Ops Inbox API: thin wrapper over /api/reviews/list with defaults.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!url.searchParams.get("view")) url.searchParams.set("view", "in_review");
  const next = new Request(url.toString(), req);
  return listGET(next);
}
