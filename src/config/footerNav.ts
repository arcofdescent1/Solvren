/**
 * Canonical footer navigation (marketing, docs, app).
 * Labels and hrefs are English-only for Phase 1; structure is translation-friendly.
 */

export const footerLegalLine = "© 2026 Solvren, Inc. All rights reserved.";

export const footerBrand = {
  name: "Solvren",
  tagline: "Revenue protection platform",
  blurb:
    "Solvren connects to your systems, detects revenue-impacting issues, quantifies impact, takes action, verifies outcomes, and proves ROI.",
  closingLine:
    "Solvren is a revenue protection platform that detects issues, automates resolution, and proves ROI.",
  logoSrc: "/images/Solvren.svg",
  logoAlt: "Solvren",
} as const;

/** Analytics event keys for optional non-blocking tracking (internal routes only). */
export const footerAnalyticsKeys = [
  "footer_pricing",
  "footer_docs",
  "footer_contact",
  "footer_security",
  "footer_privacy",
  "footer_terms",
] as const;

export type FooterAnalyticsKey = (typeof footerAnalyticsKeys)[number];

export type FooterNavLink = {
  label: string;
  href: string;
  /** When set, footer may fire optional analytics (e.g. gtag) on click. */
  analyticsKey?: FooterAnalyticsKey;
  /** True external URL (opens new tab with rel). Omit for internal routes. */
  external?: boolean;
};

export type FooterColumn = {
  id: "product" | "company" | "legal";
  heading: string;
  links: FooterNavLink[];
};

export const marketingFooterColumns: FooterColumn[] = [
  {
    id: "product",
    heading: "Product",
    links: [
      { label: "Platform Overview", href: "/platform" },
      { label: "Executive Risk Engine", href: "/platform/executive-risk-engine" },
      { label: "Approvals & Readiness", href: "/platform/approvals" },
      // Marketing overview: `/integrations` is reserved for the authenticated app hub.
      { label: "Integrations", href: "/platform/integrations" },
      { label: "Security", href: "/security", analyticsKey: "footer_security" },
      { label: "Documentation", href: "/docs", analyticsKey: "footer_docs" },
      { label: "Pricing", href: "/pricing", analyticsKey: "footer_pricing" },
    ],
  },
  {
    id: "company",
    heading: "Company",
    links: [
      { label: "About Solvren", href: "/about" },
      { label: "Contact", href: "/contact", analyticsKey: "footer_contact" },
      { label: "Careers", href: "/careers" },
      { label: "Status", href: "/status" },
      { label: "Release Notes", href: "/docs/release-notes" },
      { label: "Talk to Sales", href: "/contact", analyticsKey: "footer_contact" },
      { label: "View Pricing", href: "/pricing", analyticsKey: "footer_pricing" },
    ],
  },
  {
    id: "legal",
    heading: "Legal & Trust",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy", analyticsKey: "footer_privacy" },
      { label: "Terms of Service", href: "/legal/terms", analyticsKey: "footer_terms" },
      { label: "Data Processing Addendum", href: "/legal/dpa" },
      { label: "Cookie Policy", href: "/legal/cookies" },
      { label: "Security & Trust", href: "/security", analyticsKey: "footer_security" },
      { label: "Responsible Disclosure", href: "/security/responsible-disclosure" },
    ],
  },
];

/** Compact links for authenticated app shell. */
export const appFooterLinks: FooterNavLink[] = [
  { label: "Privacy", href: "/legal/privacy", analyticsKey: "footer_privacy" },
  { label: "Terms", href: "/legal/terms", analyticsKey: "footer_terms" },
  { label: "Security", href: "/security", analyticsKey: "footer_security" },
  { label: "Status", href: "/status" },
  { label: "Support", href: "/support" },
];

/** Optional trust badge slots (image URLs + alt); empty in Phase 1. */
export const footerTrustBadges: { src: string; alt: string; href?: string }[] = [];
