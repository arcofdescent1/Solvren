/**
 * Trust Center — security information request.
 * Accepts form submissions from the Trust Center "Request security information" flow.
 * Sends email via Resend when RESEND_API_KEY, EMAIL_FROM, and SECURITY_REQUEST_RECIPIENT are set.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendSecurityRequestEmail } from "@/services/trust/sendSecurityRequestEmail";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().min(1, "Company is required"),
  needs: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { name, email, company, needs } = parsed.data;

    const result = await sendSecurityRequestEmail({ name, email, company, needs });

    if (result.sent) {
      return NextResponse.json({ ok: true });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[trust/security-request] Email not sent:", result.error, { name, email, company, needs });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
