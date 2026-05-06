"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useIsDemoOrg } from "@/lib/hooks/useIsDemoOrg";

const DEMO_MSG = "Simulated action recorded (demo mode)";

/**
 * Wraps UI that would invoke Slack in production. In demo workspaces, blocks navigation/API and shows an inline toast (middleware already blocks writes).
 */
export function DemoSlackSimulate({
  children,
  label = "Slack action",
}: {
  children: ReactNode;
  label?: string;
}) {
  const { isDemo, loading } = useIsDemoOrg();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (loading || !isDemo) {
    return <>{children}</>;
  }

  function simulate() {
    setToast(DEMO_MSG);
  }

  return (
    <>
      <span
        className="inline-flex"
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          simulate();
        }}
        onKeyDownCapture={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            simulate();
          }
        }}
        role="presentation"
        title={`${label} (demo simulation)`}
      >
        {children}
      </span>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text)] shadow-[var(--shadow-md)]"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
