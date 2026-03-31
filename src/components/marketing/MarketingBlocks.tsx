import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, CheckCircle2, CircleDollarSign, FileCheck2, Gauge, LockKeyhole, Search, ShieldCheck, Sparkles, TimerReset, Zap, Layers3, BrainCircuit, Bot, Users, Activity, Building2, Workflow, Eye, AlertTriangle, Receipt, Landmark, Cpu } from "lucide-react";
import {
  CORE_LOOP,
  FINAL_CTA,
  HERO,
  HOW_IT_WORKS,
  INTEGRATIONS,
  ROI_SECTION,
  TRUST_BAR,
  USE_CASES,
  VALUE_PROPS,
} from "./landingCopy";
import { Button } from "@/ui";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

const iconMap = {
  Sparkles,
  CircleDollarSign,
  Bot,
  Eye,
  ShieldCheck,
  Users,
  Workflow,
  BadgeCheck,
  LockKeyhole,
  Search,
  AlertTriangle,
  Receipt,
  Landmark,
  Cpu,
  Gauge,
  FileCheck2,
  Activity,
  Building2,
  TimerReset,
  Layers3,
  BrainCircuit,
  Zap,
  BarChart3,
  CheckCircle2,
} as const;

type IconName = keyof typeof iconMap;

type Feature = {
  title: string;
  body: string;
  icon: IconName;
};

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function HeroSection({
  eyebrow = "Revenue protection platform",
  title,
  subtitle,
  primaryCta = { href: "/signup", label: "Get Started" },
  secondaryCta = { href: "/demo", label: "Book a Demo" },
  tertiaryCta,
  trustItems,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  tertiaryCta?: { href: string; label: string };
  trustItems?: string[];
}) {
  const items = trustItems ?? TRUST_BAR.items;
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(99,102,241,0.18),_transparent_26%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,1))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <div className="relative mx-auto grid max-w-7xl gap-16 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            {subtitle}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href={primaryCta.href}>
              <Button size="lg" className="bg-white text-slate-950 hover:brightness-95">
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                {secondaryCta.label}
              </Button>
            </Link>
            {tertiaryCta && (
              <Link href={tertiaryCta.href} className="text-sm font-medium text-cyan-300 underline-offset-4 hover:underline">
                {tertiaryCta.label}
              </Link>
            )}
          </div>
          <div className="mt-10 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <HeroShowcase />
      </div>
    </section>
  );
}

function HeroShowcase() {
  return (
    <div className="relative lg:pl-4">
      <div className="absolute -left-6 top-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute right-0 top-1/3 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="relative rounded-[32px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] p-5">
          <div className="flex items-center justify-between rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Live change in review</div>
              <div className="mt-1 text-lg font-semibold text-white">Stripe Pricing Logic Update</div>
            </div>
            <div className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">High Risk</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MockPanel title="Revenue Impact" tone="cyan">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span>Risk score</span>
                  <span className="font-semibold text-white">83 / 100</span>
                </div>
                <div className="space-y-2">
                  {[
                    "Incorrect invoice generation",
                    "Subscription downgrade mismatch",
                    "Revenue recognition drift",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </MockPanel>
            <MockPanel title="Suggested Reviewers" tone="indigo">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/8 bg-slate-950/40 p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Suggested reviewers</div>
                  <div className="mt-2 space-y-2">
                    {[
                      "Finance Reviewer — Pricing governance",
                      "Billing Owner — Stripe ownership",
                    ].map((item) => (
                      <div key={item} className="rounded-lg bg-white/5 px-3 py-2 text-white">{item}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/8 bg-slate-950/40 p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Required safeguards</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      "Rollback plan",
                      "Pricing test scenarios",
                      "Revenue validation",
                    ].map((item) => (
                      <span key={item} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            </MockPanel>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { label: "Active changes", value: "14" },
              { label: "Blocked by missing evidence", value: "3" },
              { label: "Overdue approvals", value: "2" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{metric.label}</div>
                <div className="mt-3 text-3xl font-black tracking-tight text-white">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPanel({ title, tone, children }: { title: string; tone: "cyan" | "indigo"; children: React.ReactNode }) {
  const classes = tone === "cyan"
    ? "border-cyan-400/20 bg-cyan-400/8"
    : "border-indigo-400/20 bg-indigo-400/10";

  return (
    <div className={`rounded-3xl border ${classes} p-4`}>
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function V1ValueCardsSection() {
  const cards = [
    { title: VALUE_PROPS[0].title, body: VALUE_PROPS[0].description, icon: Search },
    { title: VALUE_PROPS[1].title, body: VALUE_PROPS[1].description, icon: Gauge },
    { title: VALUE_PROPS[2].title, body: VALUE_PROPS[2].description, icon: Zap },
    { title: VALUE_PROPS[3].title, body: VALUE_PROPS[3].description, icon: CheckCircle2 },
    { title: VALUE_PROPS[4].title, body: VALUE_PROPS[4].description, icon: BarChart3 },
  ];
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/20 hover:bg-white/8"
            >
              <c.icon className="h-8 w-8 text-cyan-400" />
              <h3 className="mt-4 text-lg font-bold text-white">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function V1FlowDiagramSection() {
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{CORE_LOOP.title}</h2>
        </div>
        <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
          {CORE_LOOP.steps.map((step, i) => (
            <div key={step.title} className="flex flex-1 flex-col items-center gap-2 sm:min-w-[140px]">
              <div className="flex w-full flex-1 flex-col rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-center transition hover:border-cyan-400/30">
                <div className="text-sm font-bold uppercase tracking-wider text-cyan-200">{step.title}</div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-300">{step.description}</p>
              </div>
              {i < CORE_LOOP.steps.length - 1 && (
                <div className="hidden shrink-0 text-slate-500 sm:block">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LogoStrip() {
  return (
    <section className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">{INTEGRATIONS.title}</h3>
          <p className="mt-2 text-sm text-slate-400">{INTEGRATIONS.description}</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {INTEGRATIONS.items.map((item) => (
            <div key={item} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-center text-sm font-semibold text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProblemSection() {
  const columns = [
    {
      title: "Without Solvren",
      points: [
        "Failed payments and refund leakage silently reduce revenue",
        "CRM and billing systems drift out of sync",
        "Teams waste time chasing issues manually across tools",
        "Nobody knows which problems matter most",
        "There is no clear way to measure recovered value or ROI",
      ],
    },
    {
      title: "With Solvren",
      points: [
        "Detect revenue-impacting issues automatically",
        "Prioritize issues by real financial impact",
        "Run safe playbooks to fix the problem",
        "Verify the outcome before closing the issue",
        "Show leadership exactly how much revenue was recovered or protected",
      ],
    },
  ];

  return (
    <SectionFrame eyebrow="Why Solvren" title="Revenue-impacting issues hide in your systems until it is too late.">
      <p className="max-w-4xl text-base leading-8 text-slate-300">
        Disconnected systems, broken billing logic, CRM drift, failed payments, and bad operational changes quietly cost companies money every day. Most teams do not find these issues until revenue is already lost.
      </p>
      <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
        Solvren is the first platform built to detect those issues early, fix them safely, and prove the financial value recovered.
      </p>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {columns.map((column) => (
          <div key={column.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-slate-950/20">
            <h3 className="text-xl font-bold text-white">{column.title}</h3>
            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              {column.points.map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

export function ValuePillarsSection() {
  const features: Feature[] = [
    {
      icon: "Search",
      title: "Detect and quantify",
      body: "Continuously monitor Stripe, HubSpot, Salesforce, and more to identify revenue-impacting issues. Score each by financial impact and confidence so you prioritize what matters most.",
    },
    {
      icon: "Zap",
      title: "Act and verify",
      body: "Run playbooks to fix issues automatically or with approval. Idempotent execution, retries, and built-in verification ensure every action actually worked.",
    },
    {
      icon: "BarChart3",
      title: "Prove ROI",
      body: "Track recovered revenue and avoided loss with a clear value dashboard. Share executive-ready ROI, playbook performance, and time-to-value insights.",
    },
  ];

  return (
    <SectionFrame eyebrow="The Closed Loop" title="A closed-loop system for protecting and growing revenue">
      <div className="grid gap-6 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = iconMap[feature.icon];
          return (
            <div key={feature.title} className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-lg shadow-slate-950/20">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">{feature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">{feature.body}</p>
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}

export function WorkflowOverviewSection() {
  const stepIcons = ["Layers3", "Search", "Gauge", "Zap", "BarChart3"] as const;
  const steps = HOW_IT_WORKS.map((s, i) => ({
    step: s.step,
    title: s.title,
    body: s.description,
    icon: stepIcons[i] ?? "Layers3",
  }));

  return (
    <SectionFrame eyebrow="How It Works" title="Get value in less than a day">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <div key={item.step} className="relative rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="absolute right-5 top-5 text-5xl font-black tracking-tight text-white/10">0{item.step}</div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-200">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}

export function FeatureShowcaseSection({ items }: { items: Array<{ eyebrow: string; title: string; body: string; bullets: string[]; badge: string; icon: IconName; reverse?: boolean; }> }) {
  return (
    <section className="border-t border-white/10 bg-slate-950 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <div key={item.title} className={`grid items-center gap-8 lg:grid-cols-2 ${item.reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  <Icon className="h-3.5 w-3.5" />
                  {item.eyebrow}
                </div>
                <h2 className="mt-5 text-4xl font-black tracking-[-0.03em] text-white">{item.title}</h2>
                <p className="mt-5 text-lg leading-8 text-slate-300">{item.body}</p>
                <div className="mt-6 space-y-3 text-sm text-slate-300">
                  {item.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/40">
                <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-sm font-semibold text-white">{item.badge}</div>
                    <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Live preview</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {item.bullets.map((bullet, idx) => (
                      <div key={bullet} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Signal {idx + 1}</div>
                        <div className="mt-2 text-base font-semibold text-white">{bullet}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AudienceCardsSection() {
  const cards = [
    {
      href: "/for-executives",
      title: "For Executives",
      body: "See revenue at risk, recovered value, avoided loss, and ROI in one place.",
      icon: "BarChart3",
    },
    {
      href: "/for-engineering",
      title: "For Engineering & Platform Teams",
      body: "Safely automate fixes with retries, idempotency, approvals, and full audit history.",
      icon: "Cpu",
    },
    {
      href: "/for-finance",
      title: "For Finance & RevOps",
      body: "Stop failed payments, refund leakage, and reconciliation issues before they impact reporting and revenue.",
      icon: "Landmark",
    },
  ] as const;

  return (
    <SectionFrame eyebrow="Why Teams Buy" title="Why executives, RevOps, finance, and engineering teams buy Solvren">
      <div className="grid gap-6 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = iconMap[card.icon];
          return (
            <Link key={card.title} href={card.href} className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/7">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">{card.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">{card.body}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
                Explore page <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </SectionFrame>
  );
}

export function FAQSection() {
  const faqs = [
    {
      q: "How is Solvren different from BI, monitoring, or ticketing tools?",
      a: "Those tools tell you what happened after the fact. Solvren detects the issue, estimates the financial impact, fixes it safely, verifies the result, and tracks the value recovered.",
    },
    {
      q: "Does Solvren require a lot of manual work?",
      a: "No. Solvren can automatically run playbooks with retries, idempotency, and verification. You can require approval for sensitive actions.",
    },
    {
      q: "Who typically owns Solvren?",
      a: "Most often it is owned by RevOps, finance systems, billing, or engineering leaders responsible for revenue-critical systems.",
    },
    {
      q: "Where should we start?",
      a: "Most companies begin by connecting Stripe and enabling detector packs for failed payments and refund leakage. Then they add HubSpot or Salesforce.",
    },
    {
      q: "How quickly can we see value?",
      a: "Most teams find their first issue and quantify their first recovered value within the first day.",
    },
  ];

  return (
    <SectionFrame eyebrow="FAQ" title="The questions executives ask once the value clicks.">
      <div className="grid gap-4 lg:grid-cols-2">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">{faq.q}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{faq.a}</p>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

export function FinalCTASection({
  title = FINAL_CTA.headline,
  body = FINAL_CTA.subheadline,
  primaryCta = FINAL_CTA.primaryCta,
  secondaryCta = FINAL_CTA.secondaryCta,
}: {
  title?: string;
  body?: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}) {
  return (
    <section className="border-t border-white/10 bg-slate-950 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,1))] p-8 text-center shadow-2xl shadow-cyan-950/40 sm:p-12">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            <Zap className="h-3.5 w-3.5" />
            Start protecting revenue
          </div>
          <h2 className="mt-6 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={primaryCta.href}>
              <Button size="lg" className="bg-white text-slate-950">{primaryCta.label}</Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                {secondaryCta.label}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ComparisonBand() {
  const rows = [
    ["Detects revenue-impacting issues automatically", "Partial", "No", "Partial", "Yes"],
    ["Quantifies financial impact", "No", "No", "No", "Yes"],
    ["Safely automates corrective actions", "No", "No", "No", "Yes"],
    ["Verifies that the issue was resolved", "No", "No", "Partial", "Yes"],
    ["Tracks recovered revenue and proves ROI", "No", "No", "No", "Yes"],
  ];
  return (
    <SectionFrame eyebrow="Differentiation" title="Most tools help you see problems. Solvren helps you fix them.">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
        <div className="grid grid-cols-5 border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          <div className="px-5 py-4">Capability</div>
          {["BI Tools", "Ticketing Tools", "Monitoring Tools", "Solvren"].map((c) => <div key={c} className="px-5 py-4">{c}</div>)}
        </div>
        {rows.map((row) => (
          <div key={row[0]} className="grid grid-cols-5 border-t border-white/10 text-sm text-slate-200">
            {row.map((cell, index) => (
              <div key={cell + index} className={`px-5 py-4 ${index === 4 ? "bg-cyan-400/10 font-semibold text-white" : ""}`}>
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

export function SecurityGrid() {
  const items: Feature[] = [
    {
      icon: "LockKeyhole",
      title: "Role-based access control",
      body: "Owner, admin, reviewer, submitter, and viewer roles keep the platform aligned to organizational responsibilities.",
    },
    {
      icon: "ShieldCheck",
      title: "Restricted visibility",
      body: "Sensitive legal, finance, and security changes stay visible only to authorized viewers, assigned approvers, and explicitly granted users.",
    },
    {
      icon: "FileCheck2",
      title: "Evidence enforcement",
      body: "Required safeguards must be satisfied before approval can complete, preventing incomplete reviews from moving risky changes forward.",
    },
    {
      icon: "Activity",
      title: "Auditability and timelines",
      body: "Every change has a full chronological history of submissions, approvals, evidence updates, comments, and automation actions.",
    },
  ];

  return (
    <SectionFrame eyebrow="Controls and trust" title="Built to handle sensitive, high-impact changes with discipline.">
      <div className="grid gap-6 lg:grid-cols-2">
        {items.map((feature) => {
          const Icon = iconMap[feature.icon];
          return (
            <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">{feature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">{feature.body}</p>
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}

export function PricingCards() {
  const tiers = [
    {
      name: "Beta design partner",
      price: "Custom",
      badge: "Best fit now",
      body: "For teams ready to pilot high-risk pricing, billing, and revenue-change workflows with guided implementation support.",
      bullets: [
        "Revenue Impact Reports and Coordination Autopilot",
        "Admin setup for roles, mappings, and domains",
        "Hands-on beta onboarding",
      ],
    },
    {
      name: "Growth",
      price: "Contact sales",
      badge: "Upcoming",
      body: "For cross-functional revenue and engineering teams who want full governance visibility across multiple domains and systems.",
      bullets: [
        "Advanced dashboards and queue workflows",
        "Restricted visibility and domain permissions",
        "Executive reporting and operational controls",
      ],
    },
  ];

  return (
    <SectionFrame eyebrow="Pricing" title="Early access is focused on high-value pilots, not self-serve commodity seats.">
      <div className="grid gap-6 lg:grid-cols-2">
        {tiers.map((tier) => (
          <div key={tier.name} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">{tier.badge}</div>
                <h3 className="mt-3 text-3xl font-black tracking-tight text-white">{tier.name}</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black tracking-tight text-white">{tier.price}</div>
                <div className="text-sm text-slate-400">per organization</div>
              </div>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-300">{tier.body}</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              {tier.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link href="/login">
                <Button size="lg" className="w-full bg-white text-slate-950">Talk to us about beta access</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

export function UseCasesSection() {
  return (
    <SectionFrame eyebrow="Core Benefits" title="What Solvren helps you solve">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {USE_CASES.map((uc) => (
          <div key={uc.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">{uc.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{uc.description}</p>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

export function MetricsStrip() {
  const metrics = [
    { label: ROI_SECTION.highlights[0], value: "Real-time" },
    { label: ROI_SECTION.highlights[1], value: "Tracked" },
    { label: ROI_SECTION.highlights[2], value: "Visible" },
    { label: ROI_SECTION.highlights[3], value: "From day one" },
  ];
  return (
    <section className="border-y border-white/10 bg-white/5 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h3 className="text-xl font-bold text-white">{ROI_SECTION.title}</h3>
          <p className="mt-2 text-sm text-slate-400">{ROI_SECTION.description}</p>
        </div>
        <div className="grid gap-6 text-center sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="text-3xl font-black tracking-tight text-white">{metric.value}</div>
            <div className="mt-2 text-sm text-slate-400">{metric.label}</div>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

function SectionFrame({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 bg-slate-950 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200">{eyebrow}</div>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">{title}</h2>
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
