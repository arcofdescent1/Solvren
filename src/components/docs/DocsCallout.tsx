import { cn } from "@/lib/cn";

const variantStyles: Record<string, string> = {
  note: "bg-[var(--bg-muted)] border-[var(--border)]",
  tip: "bg-[rgba(0,207,213,0.08)] border-[var(--info)]",
  warning: "bg-[rgba(244,161,0,0.1)] border-[var(--warning)]",
  success: "bg-[rgba(0,172,105,0.08)] border-[var(--success)]",
};

const titleDefault: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  success: "Success",
};

export function DocsCallout(p: {
  variant?: "note" | "tip" | "warning" | "success";
  title?: string;
  children: React.ReactNode;
}) {
  const v = p.variant ?? "note";
  const label = p.title ?? titleDefault[v];
  return (
    <div
      className={cn("my-6 rounded-lg border-l-4 p-4 text-[var(--text)]", variantStyles[v])}
      role="note"
    >
      <p className="font-semibold">{label}</p>
      <div className="mt-2 [&>*:first-child]:mt-0 [&>*+*]:mt-2">{p.children}</div>
    </div>
  );
}
