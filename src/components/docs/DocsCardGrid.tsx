import { cn } from "@/lib/cn";

export function DocsCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "my-8 grid gap-4 sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}
