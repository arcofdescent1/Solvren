import { Card, CardBody } from "@/ui";

type VerificationRun = {
  id: string;
  verification_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result_summary: string | null;
};

export function IssueVerificationPanel({
  verificationStatus,
  runs,
}: {
  verificationStatus: string;
  runs: VerificationRun[];
}) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Verification</h3>
        <p className="text-sm mb-2">
          Status: <span className="font-medium capitalize">{verificationStatus.replace("_", " ")}</span>
        </p>
        {runs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No verification runs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5">
                <span className="font-medium">{r.verification_type.replace(/_/g, " ")}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {r.status} · {new Date(r.started_at).toLocaleString()}
                  {r.completed_at && ` → ${new Date(r.completed_at).toLocaleString()}`}
                </span>
                {r.result_summary && <p className="text-xs">{r.result_summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
