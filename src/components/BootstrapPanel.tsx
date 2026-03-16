"use client";;
import { Button } from "@/ui";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BootstrapPanel({
  orgId,
  isAdmin,
}: {
  orgId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [alreadySeeded, setAlreadySeeded] = useState<boolean | null>(null);

  async function bootstrap() {
    setLoading(true);
    setMessage(null);
    setAlreadySeeded(null);

    const res = await fetch("/api/org/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMessage(data?.error ?? "Bootstrap failed.");
      return;
    }

    if (data.alreadySeeded) {
      setAlreadySeeded(true);
      setMessage("This org is already bootstrapped. No changes made.");
    } else {
      setMessage("Solvren defaults seeded: signal definitions, mitigations, and approval requirements.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Solvren bootstrap</h2>
      <p className="text-sm opacity-80">
        Seed default signal definitions, mitigations, and approval requirements for this org (REVENUE domain). Safe to run once per org; subsequent calls return already seeded.
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={bootstrap}
          disabled={loading || !isAdmin}
          className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
        >
          {loading ? "Seeding..." : "Bootstrap now"}
        </Button>
        {message && (
          <span className={`text-sm ${alreadySeeded === true ? "opacity-80" : "text-green-700 dark:text-green-400"}`}>
            {message}
          </span>
        )}
      </div>
      {!isAdmin && (
        <p className="text-xs opacity-70">Only org admins can run bootstrap.</p>
      )}
    </div>
  );
}
