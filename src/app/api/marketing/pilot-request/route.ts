import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPilotRequestEmail } from "@/services/marketing/sendPilotRequestEmail";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  role: z.string().min(1),
  revenueSystems: z.string().min(1),
  mainConcern: z.string().min(1),
  targetTimeline: z.string().min(1),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const result = await sendPilotRequestEmail(parsed.data);
    if (result.sent) return NextResponse.json({ ok: true });

    if (process.env.NODE_ENV === "development") {
      console.log("[marketing/pilot-request] Email not sent:", result.error, parsed.data);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
