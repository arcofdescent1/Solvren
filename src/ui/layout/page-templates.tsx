import * as React from "react";
import { cn } from "@/lib/cn";
import { PageActionBar, type PageActionBarItem } from "./page-action-bar";
import { PageHeaderV2, type PageHeaderV2Props } from "./page-header-v2";

type TemplateWidth = "narrow" | "standard" | "wide" | "full";

const widthClass: Record<TemplateWidth, string> = {
  narrow: "max-w-4xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export type PageTemplateProps = {
  header: PageHeaderV2Props;
  actionBarItems?: PageActionBarItem[];
  actionBarActions?: React.ReactNode;
  actionBarLabel?: string;
  stickyActionBar?: boolean;
  width?: TemplateWidth;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PageTemplate({
  header,
  actionBarItems,
  actionBarActions,
  actionBarLabel,
  stickyActionBar = true,
  width = "standard",
  children,
  className,
  contentClassName,
}: PageTemplateProps) {
  return (
    <div className={cn("space-y-6", widthClass[width], className)}>
      <PageHeaderV2 {...header} />
      <PageActionBar
        items={actionBarItems}
        actions={actionBarActions}
        ariaLabel={actionBarLabel}
        sticky={stickyActionBar}
      />
      <main className={cn("space-y-6", contentClassName)}>{children}</main>
    </div>
  );
}

export type StandardPageTemplateProps = Omit<PageTemplateProps, "width"> & {
  width?: TemplateWidth;
};

export function HomePageTemplate(props: StandardPageTemplateProps) {
  return <PageTemplate width="wide" {...props} />;
}

export function ListPageTemplate(props: StandardPageTemplateProps) {
  return <PageTemplate width="wide" {...props} />;
}

export function DetailPageTemplate(props: StandardPageTemplateProps) {
  return <PageTemplate width="wide" {...props} />;
}

export function SetupPageTemplate(props: StandardPageTemplateProps) {
  return <PageTemplate width="standard" {...props} />;
}

export function ProofReportTemplate(props: StandardPageTemplateProps) {
  return <PageTemplate width="wide" {...props} />;
}

export function AdminPageTemplate(props: StandardPageTemplateProps) {
  return <PageTemplate width="wide" {...props} />;
}
