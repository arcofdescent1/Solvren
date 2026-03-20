"use client";
import { Button, Input } from "@/ui";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function normalizeSlackUserId(input: string) {
  const s = input.trim();
  if (!s) return null;
  return s.toUpperCase();
}

function isValidSlackUserId(id: string) {
  return /^[UW][A-Z0-9]{5,}$/.test(id);
}

export default function SlackLinkPanel({
  orgId,
  initialSlackUserId,
}: {
  orgId: string;
  initialSlackUserId: string | null;
}) {
  const router = useRouter();
  const [slackUserId, setSlackUserId] = useState(initialSlackUserId ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSlackUserId(initialSlackUserId ?? ""));
  }, [initialSlackUserId]);

  async function save() {
    setMsg(null);

    const normalized = normalizeSlackUserId(slackUserId);
    if (!normalized) {
      setMsg("Enter your Slack member ID (e.g., U012ABCDEF).");
      return;
    }
    if (!isValidSlackUserId(normalized)) {
      setMsg(
        "That doesn't look like a Slack member ID. It usually starts with U (or W)."
      );
      return;
    }

    setSaving(true);

    const resp = await fetch("/api/slack/user-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, slack_user_id: normalized }),
    });

    const json = await resp.json().catch(() => ({}));
    setSaving(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to save Slack user link.");
      return;
    }

    setMsg("Slack user linked ✅");
    router.refresh();
  }

  async function clear() {
    setMsg(null);
    setSaving(true);

    const resp = await fetch("/api/slack/user-map", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });

    const json = await resp.json().catch(() => ({}));
    setSaving(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Failed to remove Slack user link.");
      return;
    }

    setSlackUserId("");
    setMsg("Removed.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Slack approvals</div>
        {initialSlackUserId ? (
          <span className="text-xs px-2 py-1 rounded bg-green-50 border">
            Linked: {initialSlackUserId}
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            Not linked
          </span>
        )}
      </div>
      <div className="text-xs opacity-70">
        Link your Slack member ID so Approve/Reject buttons only work for you
        (secure one-click approvals).
      </div>
      <Input
        className="border rounded px-3 py-2 w-full"
        placeholder="Slack member ID (e.g., U012ABCDEF)"
        value={slackUserId}
        onChange={(e) => setSlackUserId(e.target.value)}
        disabled={saving}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            onClick={save}
            disabled={saving}
            className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Slack ID"}
          </Button>

          <Button
            onClick={clear}
            disabled={saving || !initialSlackUserId}
            className="px-3 py-2 rounded border text-sm disabled:opacity-60"
          >
            Remove
          </Button>
        </div>

        {msg && <div className="text-xs opacity-70">{msg}</div>}
      </div>
      <details className="text-xs opacity-80">
        <summary className="cursor-pointer underline">
          How do I find my Slack member ID?
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            In Slack, click your profile →{" "}
            <span className="font-medium">Profile</span> → More →{" "}
            <span className="font-medium">Copy member ID</span>.
          </div>
          <div className="opacity-70">
            If you can&apos;t find it, ask an admin to enable &quot;Copy member
            ID&quot; in Slack, or paste your profile link and we&apos;ll add a
            &quot;find by email&quot; later.
          </div>
        </div>
      </details>
    </div>
  );
}
