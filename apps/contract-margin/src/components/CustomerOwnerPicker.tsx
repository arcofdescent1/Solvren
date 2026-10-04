"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerOwnerPicker({ orgId, customerId, selected, members }: {
  orgId: string; customerId: string; selected: string | null;
  members: Array<{ user_id: string; email: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(event: React.ChangeEvent<HTMLSelectElement>) {
    setBusy(true); setError("");
    const response = await fetch(`/api/organizations/${orgId}/customers/${customerId}/owner`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: event.target.value || null }),
    });
    setBusy(false);
    if (!response.ok) { const result = await response.json(); setError(result.error ?? "Owner could not be changed."); return; }
    router.refresh();
  }
  return <div className="field"><label htmlFor="customer-owner">Decision owner</label><select className="select" id="customer-owner" defaultValue={selected ?? ""} disabled={busy} onChange={change}><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.email}</option>)}</select>{error && <p className="message error" role="alert">{error}</p>}</div>;
}
