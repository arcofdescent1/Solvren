"use client";

import * as React from "react";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { Content } from "./Content";
import { LayoutProvider, useLayout } from "./LayoutContext";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import type { OrgMembership } from "@/lib/org/activeOrg";

export type AppShellClientProps = {
  user?: { id: string; email?: string } | null;
  memberships?: OrgMembership[];
  activeOrgId?: string | null;
  unreadCount?: number;
  myWorkCount?: number;
  needsReviewCount?: number;
  children: React.ReactNode;
};

function AppShellInner({
  user,
  memberships,
  activeOrgId,
  unreadCount,
  myWorkCount,
  needsReviewCount,
  children,
}: AppShellClientProps) {
  const { sidebarOpen, setSidebarOpen } = useLayout();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <Topbar
        user={user}
        memberships={memberships}
        activeOrgId={activeOrgId}
        unreadCount={unreadCount}
        myWorkCount={myWorkCount}
        needsReviewCount={needsReviewCount}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <Sidebar
        user={user}
        open={sidebarOpen}
      />
      {/* Overlay when sidebar open on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-[var(--topbar-height)] z-[var(--z-content)] bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Content>{children}</Content>
    </div>
  );
}

export function AppShellClient(props: AppShellClientProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <LayoutProvider defaultSidebarOpen={true}>
        <AppShellInner {...props} />
      </LayoutProvider>
    </TooltipProvider>
  );
}
