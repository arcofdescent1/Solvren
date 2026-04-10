import type { Metadata } from "next";
import { SimpleLegalPage } from "@/components/legal/SimpleLegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Solvren uses cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <SimpleLegalPage title="Cookie Policy">
      <p>
        This Cookie Policy explains how Solvren uses cookies and similar technologies on our websites and product
        surfaces. We use these technologies to operate the service, maintain security, remember preferences, and
        understand usage in aggregate.
      </p>
      <p>
        <strong className="text-white">Essential cookies.</strong> Some cookies are strictly necessary for
        authentication, session management, load balancing, and security. These cannot be disabled without affecting
        core functionality.
      </p>
      <p>
        <strong className="text-white">Analytics.</strong> Where enabled, we may use analytics cookies or similar tools
        to measure performance and improve the product. Any such use will be described in product settings or notices
        as applicable.
      </p>
      <p>
        <strong className="text-white">Your choices.</strong> Browser settings allow you to block or delete cookies.
        Blocking essential cookies may prevent sign-in or other features from working correctly.
      </p>
      <p>
        When a consent management tool is introduced, we will link preference controls from this policy and the site
        footer as described in product documentation.
      </p>
    </SimpleLegalPage>
  );
}
