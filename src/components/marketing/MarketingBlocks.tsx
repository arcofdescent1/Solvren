import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, CheckCircle2, CircleDollarSign, FileCheck2, Gauge, LockKeyhole, Search, ShieldCheck, Sparkles, TimerReset, Zap, Layers3, BrainCircuit, Bot, Users, Activity, Building2, Workflow, Eye, AlertTriangle, Receipt, Landmark, Cpu } from "lucide-react";
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
  eyebrow,
  title,
  subtitle,
  primaryCta = { href: "/pricing", label: "Request beta access" },
  secondaryCta = { href: "/how-it-works", label: "See how it works" },
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}) {
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
          </div>
          <div className="mt-10 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
            {[
              "Spot risky pricing and billing changes before they ship",
              "Coordinate reviewers and safeguards automatically",
              "Give leaders real-time visibility into blocked and overdue work",
            ].map((item) => (
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
            <div className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">High risk</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MockPanel title="Revenue Impact Report" tone="cyan">
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
            <MockPanel title="Coordination Autopilot" tone="indigo">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/8 bg-slate-950/40 p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Suggested approvers</div>
                  <div className="mt-2 space-y-2">
                    {[
                      "Finance Reviewer — pricing governance",
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
              { label: "Changes in review", value: "14" },
              { label: "Blocked by evidence", value: "3" },
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
    {
      title: "Detect Revenue Risk",
      body: "Automatically detect pricing and billing changes.",
      icon: ShieldCheck,
    },
    {
      title: "Govern Changes",
      body: "Require approvals before revenue-impacting changes go live.",
      icon: LockKeyhole,
    },
    {
      title: "Prove Compliance",
      body: "Export governance reports for finance and auditors.",
      icon: BarChart3,
    },
  ];
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
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
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-slate-900/60 p-8">
          <div className="flex flex-wrap items-center justify-center gap-4 text-center">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sources</div>
              <div className="flex gap-2">
                {["Jira", "Salesforce", "NetSuite"].map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-2xl text-slate-500">↓</div>
            <div className="rounded-xl border-2 border-cyan-400/30 bg-cyan-400/10 px-6 py-3">
              <span className="font-bold text-white">Solvren</span>
            </div>
            <div className="text-2xl text-slate-500">↓</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-3">
              <span className="font-semibold text-white">Revenue Risk Dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LogoStrip() {
  return (
    <section className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Built for teams managing risk across the revenue stack</div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            "Stripe",
            "Chargebee",
            "Salesforce",
            "HubSpot",
            "NetSuite",
            "Data Warehouse",
          ].map((item) => (
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
        "Approvals buried in Slack threads and tickets",
        "Missing rollback plans and evidence at review time",
        "No shared view of financial exposure before release",
      ],
    },
    {
      title: "What breaks",
      points: [
        "Billing errors and pricing regressions hit customers",
        "Revenue recognition issues surface after changes ship",
        "Critical reviewers are looped in too late",
      ],
    },
    {
      title: "Why existing tools fall short",
      points: [
        "Jira tracks work but not financial risk",
        "Spreadsheets track approvals but not safeguards",
        "Slack coordinates conversation, not accountability",
      ],
    },
  ];

  return (
    <SectionFrame eyebrow="The problem" title="Revenue-impacting changes are still coordinated like tribal knowledge.">
      <div className="grid gap-6 lg:grid-cols-3">
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
      icon: "CircleDollarSign",
      title: "Revenue Risk Intelligence",
      body: "Analyze pricing, billing, and revenue-impacting changes before they ship. Surface financial exposure, likely failure modes, and the safeguards that matter most.",
    },
    {
      icon: "Bot",
      title: "Coordination Autopilot",
      body: "Automatically identify the right reviewers, evidence, and routing based on systems, domains, and change type — then apply them in one click.",
    },
    {
      icon: "Eye",
      title: "Governance Visibility",
      body: "See what is in review, blocked, overdue, restricted, or high-risk — with dashboards, queues, timelines, and executive-ready summaries.",
    },
  ];

  return (
    <SectionFrame eyebrow="Why teams buy" title="The platform that makes risky operational changes visible, coordinated, and governable.">
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
  const steps = [
    {
      step: "01",
      title: "Capture the change",
      body: "Structured intake records systems, change type, domain, rollout method, customer impact, and revenue context in one place.",
      icon: "Layers3",
    },
    {
      step: "02",
      title: "Autopilot coordinates the work",
      body: "The platform suggests the right approvers, evidence, and routing automatically, so teams stop coordinating through Slack and memory.",
      icon: "Bot",
    },
    {
      step: "03",
      title: "Risk is analyzed before release",
      body: "Revenue Impact Reports summarize financial risk, likely failure modes, and the safeguards that reduce exposure most.",
      icon: "BrainCircuit",
    },
    {
      step: "04",
      title: "Review with full context",
      body: "Approvers see the timeline, evidence, coordination plan, and risk analysis before approving — with queues for blocked, overdue, and restricted work.",
      icon: "Gauge",
    },
  ] as const;

  return (
    <SectionFrame eyebrow="How it works" title="From change submission to executive visibility in one governed flow.">
      <div className="grid gap-6 lg:grid-cols-4">
        {steps.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <div key={item.step} className="relative rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="absolute right-5 top-5 text-5xl font-black tracking-tight text-white/10">{item.step}</div>
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
      title: "For executives",
      body: "See which active changes carry the most financial risk, where safeguards are missing, and where approvals are stuck.",
      icon: "BarChart3",
    },
    {
      href: "/for-engineering",
      title: "For engineering",
      body: "Give platform and application teams a governed, auditable way to ship high-risk operational changes without coordination chaos.",
      icon: "Cpu",
    },
    {
      href: "/for-finance",
      title: "For finance & RevOps",
      body: "Protect pricing, billing, and revenue-recognition logic with structured reviews, evidence requirements, and cross-functional accountability.",
      icon: "Landmark",
    },
  ] as const;

  return (
    <SectionFrame eyebrow="Built for cross-functional teams" title="Choose the lens that matches the buyer in the room.">
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
      q: "Why not just use Jira or our ticketing system?",
      a: "Jira tracks work. Solvren governs financially risky operational changes. It determines who must review, what safeguards are required, and how much revenue risk the change carries before it ships.",
    },
    {
      q: "Does this slow teams down?",
      a: "It reduces coordination overhead by replacing Slack chases, spreadsheet approvals, and tribal knowledge with structured intake, automated reviewer suggestions, and evidence requirements that are visible from the start.",
    },
    {
      q: "Who owns this inside the organization?",
      a: "The strongest early buyers are RevOps, finance systems, billing/platform, and engineering leaders responsible for pricing, billing, subscription, and revenue-recognition workflows.",
    },
    {
      q: "Where do most teams start?",
      a: "Start with the highest-risk workflows: pricing logic, billing changes, subscription lifecycle rules, and revenue-recognition changes. Once value is clear, expand to adjacent revenue systems.",
    },
    {
      q: "How does Solvren prove value?",
      a: "By reducing missed stakeholders, surfacing risk before release, preventing approval without evidence, and giving leaders visibility into blocked, overdue, and high-risk changes in one system.",
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
  title = "Govern revenue-impacting changes before they govern you.",
  body = "Solvren helps teams identify financial risk, coordinate the right stakeholders, and move high-risk changes through a repeatable, auditable workflow.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="border-t border-white/10 bg-slate-950 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,1))] p-8 text-center shadow-2xl shadow-cyan-950/40 sm:p-12">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            <Zap className="h-3.5 w-3.5" />
            Beta access open
          </div>
          <h2 className="mt-6 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing">
              <Button size="lg" className="bg-white text-slate-950">Request beta access</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                Sign in
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
    ["Understands financial risk", "Jira", "Slack", "Spreadsheets", "Solvren"],
    ["Suggests reviewers and safeguards", "—", "—", "Manual", "Yes"],
    ["Blocks approval when evidence is missing", "Manual", "No", "No", "Yes"],
    ["Gives executives real-time exposure visibility", "No", "No", "No", "Yes"],
  ];
  return (
    <SectionFrame eyebrow="Why it is different" title="Generic work tools track tasks. Solvren governs risky revenue changes.">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
        <div className="grid grid-cols-5 border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          <div className="px-5 py-4">Capability</div>
          {rows[0].slice(1).map((c) => <div key={c} className="px-5 py-4">{c}</div>)}
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

export function MetricsStrip() {
  const metrics = [
    { label: "High-risk changes surfaced before release", value: "100%" },
    { label: "Approval coordination overhead reduced", value: "Hours → Minutes" },
    { label: "Single system of record for change governance", value: "1" },
  ];
  return (
    <section className="border-y border-white/10 bg-white/5 py-8">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 text-center sm:grid-cols-3 sm:px-6 lg:px-8">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="text-3xl font-black tracking-tight text-white">{metric.value}</div>
            <div className="mt-2 text-sm text-slate-400">{metric.label}</div>
          </div>
        ))}
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
