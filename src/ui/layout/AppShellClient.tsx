"use client";

import * as React from "react";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { Content } from "./Content";
import { LayoutProvider, useLayout } from "./LayoutContext";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import type { OrgMembership } from "@/lib/org/activeOrg";
import { AppFooter } from "@/components/footer/AppFooter";
import { Phase3AdoptionBanner } from "@/components/onboarding/phase3/Phase3AdoptionBanner";
import { Phase4EnterpriseBanner } from "@/components/onboarding/phase4/Phase4EnterpriseBanner";
import { DemoOrgBanner } from "@/components/demo/DemoOrgBanner";

export type AppShellClientProps = {
  user?: { id: string; email?: string } | null;
  memberships?: OrgMembership[];
  activeOrgId?: string | null;
  unreadCount?: number;
  myWorkCount?: number;
  needsReviewCount?: number;
  phase3Banner?: { show: boolean; phase3Status: string | null; eligible: boolean } | null;
  phase4Banner?: {
    show: boolean;
    phase4Status: string | null;
    cadenceReminder: boolean;
    executiveStreak: number;
    executiveTarget: number;
  } | null;
  /** True when active org is a synthetic demo workspace (e.g. BluePeak). */
  isDemoOrg?: boolean;
  children: React.ReactNode;
};

function AppShellInner({
  user,
  memberships,
  activeOrgId,
  unreadCount,
  myWorkCount,
  needsReviewCount,
  phase3Banner,
  phase4Banner,
  isDemoOrg,
  children,
}: AppShellClientProps) {
  const { sidebarOpen, setSidebarOpen } = useLayout();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)] text-[var(--text)]">
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
      {isDemoOrg ? <DemoOrgBanner /> : null}
      {phase3Banner?.show ? (
        <Phase3AdoptionBanner phase3Status={phase3Banner.phase3Status} eligible={phase3Banner.eligible} />
      ) : phase4Banner?.show ? (
        <Phase4EnterpriseBanner
          phase4Status={phase4Banner.phase4Status}
          cadenceReminder={phase4Banner.cadenceReminder}
          executiveStreak={phase4Banner.executiveStreak}
          executiveTarget={phase4Banner.executiveTarget}
        />
      ) : null}
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
      <div className="flex min-h-0 flex-1 flex-col">
        <Content className="min-h-0 flex-1">{children}</Content>
        <AppFooter />
      </div>
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
