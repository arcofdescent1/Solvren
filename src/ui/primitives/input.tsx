import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--input-solid-bg)] px-3 py-2 text-[0.875rem] text-[var(--text)] shadow-none transition-colors placeholder:text-[var(--text-muted)] hover:bg-[var(--input-solid-bg-hover)] focus:bg-[var(--input-solid-bg-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
