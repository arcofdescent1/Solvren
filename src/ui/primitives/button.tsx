import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-4 py-2 text-[0.875rem] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm hover:brightness-95 active:brightness-90",
        secondary: "bg-[var(--input-solid-bg)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--input-solid-bg-hover)]",
        outline: "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--table-row-hover)]",
        ghost: "bg-transparent text-[var(--text)] hover:bg-[var(--table-row-hover)]",
        destructive: "bg-[var(--danger)] text-white shadow-sm hover:brightness-95 active:brightness-90",
        link: "bg-transparent text-[var(--primary)] hover:underline px-0",
      },
      size: {
        sm: "h-9 px-3 rounded-[10px]",
        md: "h-10 px-4 rounded-[10px]",
        lg: "h-11 px-5 rounded-[12px] text-[0.95rem]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
