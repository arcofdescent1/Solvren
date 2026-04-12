import Link from "next/link";
import { Stack } from "@/ui/layout/stack";
import { PageHeader } from "@/ui/layout/page-header";
import { Button } from "@/ui/primitives/button";

export const runtime = "nodejs";

export default function InternalHomePage() {
  return (
    <Stack gap={6}>
      <PageHeader title="Internal" description="Customer accounts (Phase 1)" />
      <div>
        <Button asChild variant="default">
          <Link href="/internal/accounts">View accounts</Link>
        </Button>
      </div>
    </Stack>
  );
}
