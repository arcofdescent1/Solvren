"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StripeMappingForm({ orgId, stripeCustomerId, customers, selected }: {
  orgId: string; stripeCustomerId: string;
  customers: Array<{ id: string; name: string }>; selected?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const customerId = new FormData(event.currentTarget).get("customerId");
    try {
      const response = await fetch(`/api/organizations/${orgId}/mappings`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          source: "stripe", sourceCustomerId: stripeCustomerId, customerId,
        }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not map customer.");
      setMessage("Stripe identity linked to the contract."); router.refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not map customer."); }
    finally { setBusy(false); }
  }
  return <form className="inline-form" onSubmit={submit}><label className="field">Contract customer<select className="select" name="customerId" defaultValue={selected ?? ""} required><option value="" disabled>Choose a contract</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><button className="button secondary" disabled={busy || !customers.length}>Link</button>{message && <span className="small" role="status">{message}</span>}</form>;
}
