import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

function absoluteUrl(path: string): string {
  const base = env.appUrl.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path}`;
}

export type SendInviteEmailParams = {
  to: string;
  orgName: string;
  inviterName: string | null;
  role: string;
  acceptLink: string;
  expiresInDays: number;
};

/**
 * Sends the org invite email. Uses Resend when RESEND_API_KEY and EMAIL_FROM are set.
 * Returns { sent: true } on success, or { sent: false, error } otherwise.
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<
  | { sent: true }
  | { sent: false; error: string }
> {
  if (!resend) {
    return { sent: false, error: "Email not configured (RESEND_API_KEY)" };
  }
  const from = env.emailFrom;
  if (!from) {
    return { sent: false, error: "Email not configured (EMAIL_FROM)" };
  }

  const { to, orgName, inviterName, role, acceptLink, expiresInDays } = params;
  const roleLabel = role === "admin" ? "Admin" : role === "reviewer" ? "Reviewer" : role === "submitter" ? "Submitter" : "Viewer";
  const inviterLine = inviterName ? ` ${inviterName} invited you to join` : " You've been invited to join";

  const subject = `Join ${orgName} on Solvren`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>You're invited to Solvren</h2>
      <p>${inviterLine} <strong>${orgName}</strong> as a <strong>${roleLabel}</strong>.</p>
      <p>Click the button below to accept the invitation. This link expires in ${expiresInDays} days and can only be used once.</p>
      <p><a href="${acceptLink}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't expect this email, you can ignore it.</p>
    </div>
  `;
  const text = `You've been invited to join ${orgName} on Solvren as a ${roleLabel}. Accept: ${acceptLink}. This link expires in ${expiresInDays} days.`;

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    return { sent: false, error: error.message };
  }
  return { sent: true };
}
