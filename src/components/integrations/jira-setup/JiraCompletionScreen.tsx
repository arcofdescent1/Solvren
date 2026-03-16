"use client";

import Link from "next/link";
import { Button, Card, CardBody } from "@/ui";

type Props = {
  siteUrl: string;
  projects: string[];
  features: { webhookSync?: boolean; issuePropertySync?: boolean; commentSync?: boolean };
};

export function JiraCompletionScreen({ siteUrl, projects, features }: Props) {
  const enabled = [
    features.webhookSync && "Webhook Sync",
    features.issuePropertySync && "Issue Property Sync",
    features.commentSync && "Comment Sync",
  ].filter(Boolean);

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="text-center">
          <h3 className="font-semibold text-xl text-green-600">Jira integration ready</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Setup is complete. Solvren is now connected to your Jira site.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4 space-y-2 text-sm">
          <p>
            <span className="text-[var(--text-muted)]">Connected site:</span>{" "}
            {siteUrl || "Jira Cloud"}
          </p>
          <p>
            <span className="text-[var(--text-muted)]">Projects monitored:</span>{" "}
            {projects.length ? projects.join(", ") : "—"}
          </p>
          <p>
            <span className="text-[var(--text-muted)]">Features enabled:</span>{" "}
            {enabled.length ? enabled.join(", ") : "None"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/org/settings/integrations/jira">
            <Button variant="outline">View integration</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Go to dashboard</Button>
          </Link>
          <Link href="/changes/new">
            <Button>Create first change</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
