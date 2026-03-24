/**
 * Sends Trust Center security information request to configured recipient.
 * Uses Resend when RESEND_API_KEY, EMAIL_FROM, and SECURITY_REQUEST_RECIPIENT are set.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export type SecurityRequestParams = {
  name: string;
  email: string;
  company: string;
  needs?: string[];
};

/**
 * Sends the security request notification. Returns { sent: true } on success,
 * or { sent: false, error } when email is not configured or send fails.
 */
export async function sendSecurityRequestEmail(
  params: SecurityRequestParams
): Promise<{ sent: true } | { sent: false; error: string }> {
  if (!resend) {
    return { sent: false, error: "Email not configured (RESEND_API_KEY)" };
  }
  const from = env.emailFrom;
  if (!from) {
    return { sent: false, error: "Email not configured (EMAIL_FROM)" };
  }
  const to = env.securityRequestRecipient;
  if (!to) {
    return { sent: false, error: "Security request recipient not configured (SECURITY_REQUEST_RECIPIENT)" };
  }

  const { name, email, company, needs } = params;
  const NEED_LABELS: Record<string, string> = {
    overview: "Security overview",
    subprocessor: "Subprocessor list",
    questionnaire: "Questionnaire",
    call: "Security call",
  };
  const needsDisplay = needs?.map((id) => NEED_LABELS[id] ?? id).join(", ") ?? "";
  const needsLine = needsDisplay
    ? `<p><strong>Needs:</strong> ${escapeHtml(needsDisplay)}</p>`
    : "";

  const subject = `Security information request from ${company}`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>Security Information Request</h2>
      <p>A visitor has requested security information via the Trust Center.</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      ${needsLine}
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        Respond to the requester at ${escapeHtml(email)}.
      </p>
    </div>
  `;
  const text = `Security information request from ${company}\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}${needsDisplay ? `\nNeeds: ${needsDisplay}` : ""}\n\nRespond to the requester at ${email}.`;

  const { error } = await resend.emails.send({
    from,
    to: [to],
    replyTo: email,
    subject,
    html,
    text,
  });

  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
