"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";

export function LinkIssueButton({ changeId }: { changeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateAndLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/changes/${changeId}/link-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createIssue: true, linkType: "origin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create and link issue");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleCreateAndLink}
        disabled={loading}
      >
        {loading ? "Creating…" : "Create & link issue"}
      </Button>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
