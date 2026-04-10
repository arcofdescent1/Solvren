import { Button } from "@/ui";
import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SegmentedTab = {
  key: string;
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
};

export function SegmentedTabs({
  tabs,
  className,
}: {
  tabs: SegmentedTab[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex rounded-[var(--rg-radius)] border border-[color:var(--rg-border)] bg-[color:var(--rg-panel)] shadow-[var(--rg-shadow-sm)] overflow-hidden",
        className
      )}
    >
      {tabs.map((t) => {
        const common =
          "px-3 py-2 text-[12.5px] font-medium transition whitespace-nowrap";
        const active = t.active
          ? "bg-[color:var(--rg-primary)] text-[color:var(--rg-primary-contrast)]"
          : "text-[color:var(--rg-text)] hover:bg-[color:var(--rg-panel-2)]";

        if (t.href) {
           
          return (
            <a key={t.key} href={t.href} className={cx(common, active)}>
              {t.label}
            </a>
          );
        }
        return (
          <Button
            key={t.key}
            type="button"
            onClick={t.onClick}
            className={cx(common, active)}
          >
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}
