"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/ui";

type Status = "idle" | "submitting" | "success" | "error";

export function PilotRequestForm({ source = "marketing" }: { source?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      company: String(formData.get("company") ?? ""),
      role: String(formData.get("role") ?? ""),
      revenueSystems: String(formData.get("revenueSystems") ?? ""),
      mainConcern: String(formData.get("mainConcern") ?? ""),
      targetTimeline: String(formData.get("targetTimeline") ?? ""),
      source,
    };
    const res = await fetch("/api/marketing/pilot-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus("error");
      setError("Something went wrong. You can also email sales@solvren.com.");
      return;
    }
    setStatus("success");
    form.reset();
  }

  return (
    <form onSubmit={submit} className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Request pilot</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Find your first revenue risk in 14 days.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Tell us where revenue can leak. We will help scope the smallest useful pilot.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" autoComplete="name" />
        <Field label="Work email" name="email" type="email" autoComplete="email" />
        <Field label="Company" name="company" autoComplete="organization" />
        <Field label="Role" name="role" placeholder="VP Finance, RevOps, Engineering" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Revenue systems" name="revenueSystems" placeholder="Stripe, Salesforce, HubSpot, NetSuite" />
        <Field label="Target timeline" name="targetTimeline" placeholder="This month, Q3, evaluating now" />
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-white">Main concern</span>
        <textarea
          name="mainConcern"
          required
          rows={4}
          placeholder="Pricing drift, billing changes, failed payments, refund leakage, CRM/billing mismatch..."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
        />
      </label>

      <Button type="submit" size="lg" className="mt-5 w-full bg-white text-slate-950 hover:brightness-95" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending..." : "Request the 14-day pilot"}
      </Button>
      {status === "success" ? (
        <p className="mt-3 text-sm font-medium text-cyan-200">Thanks. We will follow up with a pilot scope and next steps.</p>
      ) : null}
      {status === "error" ? <p className="mt-3 text-sm font-medium text-rose-200">{error}</p> : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-white">{label}</span>
      <input
        name={name}
        type={type}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
      />
    </label>
  );
}
