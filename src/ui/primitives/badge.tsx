import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--primary)] text-white",
        secondary: "border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text)]",
        success: "border-transparent bg-[var(--success)] text-white",
        warning: "border-transparent bg-[var(--warning)] text-[var(--text-inverse)]",
        danger: "border-transparent bg-[var(--danger)] text-white",
        outline: "border-[var(--border)] bg-transparent text-[var(--text)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
