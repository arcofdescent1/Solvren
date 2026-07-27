import type { Metadata } from "next";
import {
  ConcreteRiskExamplesSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  PilotOfferSection,
  ProofArtifactsSection,
  RevenueProtectionPromiseSection,
  WhoThisIsForSection,
} from "@/components/marketing/MarketingBlocks";

export const metadata: Metadata = {
  title: "What Is Revenue Protection?",
  description:
    "Learn how revenue protection helps B2B SaaS teams find revenue leaks and risky revenue-system changes before they cost money.",
};

export default function RevenueProtectionPage() {
  return (
    <MarketingShell>
      <HeroSection
        eyebrow="Revenue protection"
        title="Revenue protection finds leaks before they become losses"
        subtitle="Revenue protection is the operating layer between finance, revenue operations, and engineering that shows what revenue is at risk, what needs action, and what value was protected."
        primaryCta={{ href: "/pilot", label: "Request Pilot" }}
        secondaryCta={{ href: "/downloads/14-day-revenue-protection-pilot-plan.md", label: "Download pilot plan" }}
        trustItems={["Find leaks", "Review risky changes", "Protect revenue", "Prove value"]}
      />
      <RevenueProtectionPromiseSection />
      <section className="border-t border-white/10 bg-slate-950 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            {
              title: "What happened?",
              body: "A system, workflow, pricing rule, billing path, refund process, or customer record changed in a way that may affect revenue.",
            },
            {
              title: "Why does it matter?",
              body: "The impact is translated into plain business terms: money at risk, customers affected, owners, missing proof, and expected next action.",
            },
            {
              title: "What should happen next?",
              body: "Solvren routes the decision or problem to the right people, tracks proof, and turns the outcome into a board-ready value story.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black tracking-tight text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
      <ConcreteRiskExamplesSection />
      <WhoThisIsForSection />
      <ProofArtifactsSection />
      <PilotOfferSection />
      <FinalCTASection
        title="Teach the category by proving the first risk."
        body="A focused pilot gives buyers a concrete way to understand revenue protection in their own systems."
        primaryCta={{ href: "/pilot", label: "Request Pilot" }}
        secondaryCta={{ href: "/pricing", label: "View pilot pricing" }}
      />
    </MarketingShell>
  );
}
