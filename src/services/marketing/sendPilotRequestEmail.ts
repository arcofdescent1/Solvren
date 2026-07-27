/**
 * Sends pilot request notifications to the configured recipient.
 * Uses Resend when RESEND_API_KEY, EMAIL_FROM, and PILOT_REQUEST_RECIPIENT are set.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export type PilotRequestParams = {
  name: string;
  email: string;
  company: string;
  role: string;
  revenueSystems: string;
  mainConcern: string;
  targetTimeline: string;
  source?: string | null;
};

export async function sendPilotRequestEmail(
  params: PilotRequestParams
): Promise<{ sent: true } | { sent: false; error: string }> {
  if (!resend) return { sent: false, error: "Email not configured (RESEND_API_KEY)" };
  const from = env.emailFrom;
  if (!from) return { sent: false, error: "Email not configured (EMAIL_FROM)" };
  const to = process.env.PILOT_REQUEST_RECIPIENT ?? process.env.SALES_REQUEST_RECIPIENT ?? process.env.SECURITY_REQUEST_RECIPIENT;
  if (!to) return { sent: false, error: "Pilot request recipient not configured (PILOT_REQUEST_RECIPIENT)" };

  const subject = `Pilot request from ${params.company}`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>14-Day Revenue Protection Pilot Request</h2>
      <p>A visitor requested a Solvren pilot.</p>
      <p><strong>Name:</strong> ${escapeHtml(params.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(params.company)}</p>
      <p><strong>Role:</strong> ${escapeHtml(params.role)}</p>
      <p><strong>Revenue systems:</strong> ${escapeHtml(params.revenueSystems)}</p>
      <p><strong>Main concern:</strong> ${escapeHtml(params.mainConcern)}</p>
      <p><strong>Target timeline:</strong> ${escapeHtml(params.targetTimeline)}</p>
      <p><strong>Source:</strong> ${escapeHtml(params.source ?? "unknown")}</p>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Respond to ${escapeHtml(params.email)}.</p>
    </div>
  `;
  const text = [
    `14-Day Revenue Protection Pilot Request from ${params.company}`,
    "",
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    `Company: ${params.company}`,
    `Role: ${params.role}`,
    `Revenue systems: ${params.revenueSystems}`,
    `Main concern: ${params.mainConcern}`,
    `Target timeline: ${params.targetTimeline}`,
    `Source: ${params.source ?? "unknown"}`,
    "",
    `Respond to ${params.email}.`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from,
    to: [to],
    replyTo: params.email,
    subject,
    html,
    text,
  });

  if (error) return { sent: false, error: error.message };
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
