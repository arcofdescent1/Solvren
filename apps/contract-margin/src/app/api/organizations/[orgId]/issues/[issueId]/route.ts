import { z } from "zod";
import { jsonError, requestOrgWriteRole } from "@/lib/api";

const schema = z.strictObject({
  action: z.enum(["acknowledged","commented","assigned","snoozed","unsnoozed","resolved"]),
  note: z.string().max(2000).nullable(),
  assigneeUserId: z.uuid().nullable(),
  snoozedUntil: z.iso.datetime({ offset: true }).nullable(),
});

export async function POST(request: Request, context: {
  params: Promise<{orgId:string;issueId:string}>;
}) {
  const {orgId,issueId} = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(issueId).success)
    return jsonError("Issue not found.",404);
  const session = await requestOrgWriteRole(orgId,["owner","finance","engineer"]);
  if (!session) return jsonError("Member access with MFA required.",403);
  const body = schema.safeParse(await request.json().catch(()=>null));
  if (!body.success) return jsonError(body.error.issues[0]?.message ?? "Invalid action.",400);
  const {error} = await session.supabase.rpc("phase3_issue_action",{
    p_org:orgId,p_issue:issueId,p_action:body.data.action,p_note:body.data.note,
    p_assignee:body.data.assigneeUserId,p_snoozed_until:body.data.snoozedUntil,
  });
  if (error) return jsonError(error.message,400);
  return Response.json({updated:true});
}
