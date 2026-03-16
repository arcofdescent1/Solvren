import {
  DocsCallout,
  DocsSteps,
  DocsStepsItem,
  DocsCardGrid,
  DocsCard,
  DocsScreenshot,
  DocsScreenshotPlaceholder,
  DocsImageScreenshot,
  DocsGallery,
  DocsGalleryItem,
  DocsReleaseTimeline,
  DocsReleaseItem,
  Mermaid,
} from "./index";

export const docsComponents = {
  Callout: (props: {
    variant?: "note" | "tip" | "warning" | "success";
    title?: string;
    children: React.ReactNode;
  }) => (
    <DocsCallout
      variant={props.variant ?? "note"}
      title={props.title}
    >
      {props.children}
    </DocsCallout>
  ),
  Steps: (props: { children: React.ReactNode }) => (
    <DocsSteps>{props.children}</DocsSteps>
  ),
  Step: (props: { number?: number; title?: string; children: React.ReactNode }) => (
    <DocsStepsItem step={props.number} title={props.title}>
      {props.children}
    </DocsStepsItem>
  ),
  CardGrid: (props: { children: React.ReactNode }) => (
    <DocsCardGrid>{props.children}</DocsCardGrid>
  ),
  Card: (props: { href: string; title: string; description: string }) => (
    <DocsCard href={props.href} title={props.title} description={props.description} />
  ),
  Screenshot: (props: { title?: string; caption?: string; children?: React.ReactNode }) => (
    <DocsScreenshot title={props.title} caption={props.caption}>
      {props.children}
    </DocsScreenshot>
  ),
  ScreenshotPlaceholder: (props: { label: string; lines?: number }) => (
    <DocsScreenshotPlaceholder label={props.label} lines={props.lines} />
  ),
  ImageScreenshot: (props: { src: string; alt: string; title?: string; caption?: string; width?: number; height?: number }) => (
    <DocsImageScreenshot src={props.src} alt={props.alt} title={props.title} caption={props.caption} width={props.width} height={props.height} />
  ),
  Gallery: (props: { children: React.ReactNode }) => <DocsGallery>{props.children}</DocsGallery>,
  GalleryItem: (props: { title?: string; caption?: string; children?: React.ReactNode }) => (
    <DocsGalleryItem title={props.title} caption={props.caption}>{props.children}</DocsGalleryItem>
  ),
  ReleaseTimeline: (props: { children: React.ReactNode }) => <DocsReleaseTimeline>{props.children}</DocsReleaseTimeline>,
  ReleaseItem: (props: { version: string; date?: string; children: React.ReactNode }) => (
    <DocsReleaseItem version={props.version} date={props.date}>{props.children}</DocsReleaseItem>
  ),
  Mermaid: (props: { chart: string }) => <Mermaid chart={props.chart} />,
  // Standard markdown overrides for docs typography
  h2: (props: React.ComponentProps<"h2">) => {
    const id = props.children
      ? String(props.children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      : "";
    return (
      <h2
        id={id}
        className="mt-10 scroll-mt-24 text-xl font-semibold text-[var(--text)] border-b border-[var(--border)] pb-2"
        {...props}
      />
    );
  },
  h3: (props: React.ComponentProps<"h3">) => {
    const id = props.children
      ? String(props.children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      : "";
    return (
      <h3 id={id} className="mt-8 scroll-mt-24 text-lg font-semibold text-[var(--text)]" {...props} />
    );
  },
  p: (props: React.ComponentProps<"p">) => (
    <p className="mt-4 text-[var(--text)] leading-relaxed" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="mt-4 ml-6 list-disc space-y-2 text-[var(--text)]" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="mt-4 ml-6 list-decimal space-y-2 text-[var(--text)]" {...props} />
  ),
  code: (props: React.ComponentProps<"code">) =>
    props.className ? (
      <code {...props} />
    ) : (
      <code
        className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-sm font-mono text-[var(--text)]"
        {...props}
      />
    ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre
      className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-4 text-sm"
      {...props}
    />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a
      className="text-[var(--primary)] hover:text-[var(--primary-hover)] underline underline-offset-2"
      {...props}
    />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="mt-4 border-l-4 border-[var(--primary)] pl-4 italic text-[var(--text-muted)]"
      {...props}
    />
  ),
};
