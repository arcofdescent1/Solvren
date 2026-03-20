"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ReadyStatus = {
  ready: boolean;
  missingEvidence: string[];
  missingApprovals: string[];
  blockingIncidents: { id: string; status: string | null }[];
  loading: boolean;
  error: string | null;
};

const defaultStatus: ReadyStatus = {
  ready: false,
  missingEvidence: [],
  missingApprovals: [],
  blockingIncidents: [],
  loading: true,
  error: null,
};

const ChangeReadyContext = createContext<ReadyStatus>(defaultStatus);

export function ChangeReadyProvider({
  changeId,
  children,
}: {
  changeId: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<ReadyStatus>(defaultStatus);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setStatus((s) => ({ ...s, loading: true, error: null }));
      }
    });

    fetch(`/api/changes/ready-status?changeId=${encodeURIComponent(changeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setStatus({
            ready: false,
            missingEvidence: [],
            missingApprovals: [],
            blockingIncidents: [],
            loading: false,
            error: data.error,
          });
          return;
        }
        setStatus({
          ready: Boolean(data.ready),
          missingEvidence: Array.isArray(data.missingEvidence)
            ? data.missingEvidence
            : [],
          missingApprovals: Array.isArray(data.missingApprovals)
            ? data.missingApprovals
            : [],
          blockingIncidents: Array.isArray(data.blockingIncidents)
            ? data.blockingIncidents
            : [],
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus({
            ready: false,
            missingEvidence: [],
            missingApprovals: [],
            blockingIncidents: [],
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [changeId]);

  return (
    <ChangeReadyContext.Provider value={status}>
      {children}
    </ChangeReadyContext.Provider>
  );
}

export function useReadyStatus(): ReadyStatus {
  return useContext(ChangeReadyContext);
}
