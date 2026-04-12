import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getInternalPageGate } from "@/lib/internal/auth";
import { InternalAppShell } from "@/components/internal/InternalAppShell";

export const runtime = "nodejs";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const g = await getInternalPageGate();
  if (g.gate === "login") {
    redirect("/login");
  }
  if (g.gate === "forbidden") {
    redirect("/dashboard");
  }

  return (
    <InternalAppShell employeeEmail={g.ctx.emailLower} employeeRole={g.ctx.employeeRole}>
      {children}
    </InternalAppShell>
  );
}
