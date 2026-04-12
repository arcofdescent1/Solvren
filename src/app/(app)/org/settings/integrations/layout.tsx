import { Suspense } from "react";
import { Phase3IntegrationConnectedQueryTracker } from "@/components/onboarding/phase3/Phase3IntegrationConnectedQueryTracker";

export default function OrgIntegrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <Phase3IntegrationConnectedQueryTracker />
      </Suspense>
      {children}
    </>
  );
}
