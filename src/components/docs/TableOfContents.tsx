"use client";

import { useEffect, useState } from "react";

type Heading = {
  id: string;
  text: string;
  level: number;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function TableOfContents({ enabled = true }: { enabled?: boolean }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!enabled) return;

    const nodes = Array.from(
      document.querySelectorAll("article h2, article h3")
    ) as HTMLHeadingElement[];

    const parsed = nodes.map((node) => {
      const text = node.innerText.trim();
      const id = node.id || slugify(text);
      if (!node.id) node.id = id;

      return {
        id,
        text,
        level: Number(node.tagName.replace("H", "")),
      };
    });

    queueMicrotask(() => setHeadings(parsed));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
          );

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "0px 0px -70% 0px",
        threshold: [0, 1],
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [enabled]);

  if (!enabled || !headings.length) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-auto text-sm lg:block lg:w-[220px] lg:shrink-0"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        On this page
      </p>
      <ul className="space-y-2 border-l border-[var(--border)] pl-4">
        {headings.map((heading) => {
          const isActive = heading.id === activeId;
          const isH3 = heading.level === 3;

          return (
            <li key={heading.id} className={isH3 ? "ml-3" : ""}>
              <a
                href={`#${heading.id}`}
                className={[
                  "block py-1 transition-colors hover:text-[var(--primary)]",
                  isActive
                    ? "font-medium text-[var(--primary)]"
                    : "text-[var(--text-muted)]",
                ].join(" ")}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
