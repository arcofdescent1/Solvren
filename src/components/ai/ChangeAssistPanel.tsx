"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, Button } from "@/ui";

type ChangeAssistResult = {
  ok: boolean;
  suggested_fields?: { change_type?: string; system?: string; impact_band?: string };
  required_evidence?: string[];
  plain_summary?: string | null;
  error?: string;
};

export type ChangeAssistPanelProps = {
  contextText: string;
  currentChangeType?: string | null;
  onApply: (applied: {
    change_type: string;
    system?: string;
    impact_band?: string;
    required_evidence?: string[];
  }) => void;
};

const DEBOUNCE_MS = 800;
const MIN_TEXT_LENGTH = 15;

export function ChangeAssistPanel({
  contextText,
  onApply,
}: ChangeAssistPanelProps) {
  const [result, setResult] = useState<ChangeAssistResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < MIN_TEXT_LENGTH) {
      setResult(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/change-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jira_issue_text: text }),
      });
      const json = (await res.json().catch(() => ({}))) as ChangeAssistResult;
      if (!res.ok) {
        setError(json.error ?? "AI suggestion unavailable");
        setResult(null);
        return;
      }
      setResult(json);
    } catch {
      setError("Request failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = contextText.trim();
    if (t.length < MIN_TEXT_LENGTH) {
      setResult(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => fetchSuggestions(t), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [contextText, fetchSuggestions]);

  const handleApply = () => {
    if (!result?.ok || !result.suggested_fields?.change_type) return;
    onApply({
      change_type: result.suggested_fields.change_type,
      system: result.suggested_fields.system ?? undefined,
      impact_band: result.suggested_fields.impact_band ?? undefined,
      required_evidence: result.required_evidence,
    });
  };

  const summary = result?.plain_summary ?? (error ? null : "Enter a title or description to get AI suggestions.");
  const suggestedType = result?.suggested_fields?.change_type;
  const impactBand = result?.suggested_fields?.impact_band;
  const evidence = result?.required_evidence ?? [];
  const canApply = result?.ok && suggestedType;

  return (
    <Card className="sticky top-4 border-[var(--primary)]/20 bg-[var(--bg-surface)]">
      <CardBody className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">AI suggestions</h3>
        {loading && <p className="text-sm text-[var(--text-muted)]">Analyzing…</p>}
        {!loading && summary && (
          <>
            <p className="text-sm text-[var(--text)]">{summary}</p>
            {suggestedType && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/50 px-3 py-2 text-xs">
                <p className="font-medium text-[var(--text-muted)]">Suggested change type</p>
                <p className="mt-0.5 font-medium text-[var(--text)]">{suggestedType.replace(/_/g, " ")}</p>
                {impactBand && <p className="mt-1 text-[var(--text-muted)]">Estimated impact: {impactBand}</p>}
                {evidence.length > 0 && <p className="mt-1 text-[var(--text-muted)]">Suggested evidence: {evidence.join(", ")}</p>}
              </div>
            )}
            {canApply && (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleApply}>
                Apply suggestions
              </Button>
            )}
          </>
        )}
        {!loading && error && <p className="text-xs text-[var(--text-muted)]">{error}. You can continue without suggestions.</p>}
        {!loading && !summary && !error && contextText.trim().length > 0 && contextText.trim().length < MIN_TEXT_LENGTH && (
          <p className="text-xs text-[var(--text-muted)]">Add a bit more detail to get suggestions.</p>
        )}
      </CardBody>
    </Card>
  );
}
