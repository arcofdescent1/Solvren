"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

const StepsContext = React.createContext<{ count: number } | null>(null);

export function DocsSteps({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(
    (c): c is React.ReactElement =>
      React.isValidElement(c) &&
      (c as React.ReactElement & { type: { displayName?: string } }).type
        ?.displayName === "DocsStepsItem"
  );
  return (
    <StepsContext.Provider value={{ count: items.length }}>
      <ol className="my-8 list-none space-y-6 pl-0">
        {items.map((child, i) =>
          React.cloneElement(child as React.ReactElement<{ step?: number }>, {
            step: i + 1,
            key: i,
          })
        )}
      </ol>
    </StepsContext.Provider>
  );
}

function DocsStepsItemImpl({
  step = 1,
  title,
  children,
  ...props
}: {
  step?: number;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4" {...props}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          "bg-[var(--primary)] text-[var(--primary-contrast)] text-sm font-semibold"
        )}
      >
        {step}
      </span>
      <div className="flex-1 pt-0.5">
        {title && (
          <p className="font-semibold text-[var(--text)]">{title}</p>
        )}
        <div className="mt-2 text-[var(--text-muted)] [&>*:first-child]:mt-0 [&>*+*]:mt-2">
          {children}
        </div>
      </div>
    </li>
  );
}

DocsStepsItemImpl.displayName = "DocsStepsItem";
export const DocsStepsItem = DocsStepsItemImpl;
