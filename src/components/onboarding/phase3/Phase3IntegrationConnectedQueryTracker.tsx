"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { postPhase3Interaction } from "./postPhase3Interaction";

/**
 * Records integration_connected when returning from OAuth with ?connected=1 on a provider settings page.
 */
export function Phase3IntegrationConnectedQueryTracker() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (search.get("connected") !== "1") return;
    const m = pathname.match(/\/org\/settings\/integrations\/([^/?#]+)/);
    const provider = m?.[1];
    if (!provider || provider === "integrations") return;
    done.current = true;
    postPhase3Interaction({
      type: "integration_connected",
      refType: `integration:${provider}`,
      refId: null,
    });
  }, [pathname, search]);

  return null;
}
