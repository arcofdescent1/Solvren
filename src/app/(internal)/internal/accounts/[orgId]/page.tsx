import { Suspense } from "react";
import { InternalAccountWorkspace } from "@/components/internal/InternalAccountWorkspace";

export const runtime = "nodejs";

export default async function InternalAccountPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <InternalAccountWorkspace orgId={orgId} />
    </Suspense>
  );
}
