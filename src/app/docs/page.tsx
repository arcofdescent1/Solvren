import {
  DocsContent,
  DocsSearch,
  DocsCommandTrigger,
} from "@/components/docs";
import { getDocBySlug } from "@/lib/docs/getDocBySlug";

export default async function DocsHomePage() {
  const indexDoc = getDocBySlug([]);

  return (
    <div className="mx-auto max-w-[900px]">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="text-sm leading-6 text-[var(--text-muted)]">
            Search signals, detectors, playbooks, verification, ROI, and more.
          </div>
        </div>
        <DocsCommandTrigger />
      </section>

      <section className="mt-6">
        <DocsSearch placeholder="Search signals, detectors, playbooks, verification, ROI, safe automation..." />
      </section>

      {indexDoc ? (
        <div className="mt-8 prose max-w-none prose-p:text-[var(--text)] prose-headings:text-[var(--text)] prose-a:text-[var(--primary)]">
          <DocsContent source={indexDoc.rawContent} />
        </div>
      ) : null}
    </div>
  );
}
