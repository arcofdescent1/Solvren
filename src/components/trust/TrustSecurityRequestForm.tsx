"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/ui/primitives/sheet";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Checkbox } from "@/ui/primitives/checkbox";

const NEED_OPTIONS = [
  { id: "overview", label: "Security overview" },
  { id: "subprocessor", label: "Subprocessor list" },
  { id: "questionnaire", label: "Questionnaire" },
  { id: "call", label: "Security call" },
] as const;

export function TrustSecurityRequestForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [needs, setNeeds] = React.useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const toggleNeed = (id: string) => {
    setNeeds((n) => ({ ...n, [id]: !n[id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !company.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/trust/security-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          needs: Object.entries(needs)
            .filter(([, v]) => v)
            .map(([k]) => k),
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setName("");
        setEmail("");
        setCompany("");
        setNeeds({});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (submitted) setTimeout(() => setSubmitted(false), 300);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="max-h-full overflow-y-auto bg-slate-900 border-slate-700">
          <SheetHeader>
            <SheetTitle className="text-white">Request security information</SheetTitle>
          </SheetHeader>
          <SheetBody>
            {submitted ? (
              <div className="py-8 text-center">
                <p className="text-slate-300">
                  Thank you. We&apos;ll follow up within 1–2 business days.
                </p>
                <Button onClick={handleClose} className="mt-6">
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="tc-name" className="block text-sm font-medium text-slate-300 mb-1">
                    Name
                  </label>
                  <Input
                    id="tc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tc-email" className="block text-sm font-medium text-slate-300 mb-1">
                    Work email
                  </label>
                  <Input
                    id="tc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tc-company" className="block text-sm font-medium text-slate-300 mb-1">
                    Company
                  </label>
                  <Input
                    id="tc-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company name"
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-300 mb-2">What do you need?</span>
                  <div className="space-y-2">
                    {NEED_OPTIONS.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <Checkbox
                          checked={!!needs[o.id]}
                          onCheckedChange={() => toggleNeed(o.id)}
                          className="border-slate-500"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Sending…" : "Submit"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
  );
}
