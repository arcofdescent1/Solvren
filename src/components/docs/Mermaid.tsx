"use client";

import mermaid from "mermaid";
import { useEffect, useId, useMemo, useState } from "react";

type MermaidProps = {
  chart: string;
};

export function Mermaid({ chart }: MermaidProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const stableId = useMemo(() => `mermaid-${id}`, [id]);

  useEffect(() => {
    let mounted = true;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
    });

    mermaid
      .render(stableId, chart)
      .then(({ svg: result }) => {
        if (mounted) setSvg(result);
      })
      .catch((err) => {
        console.error("Failed to render Mermaid diagram:", err);
        if (mounted) {
          setSvg(
            '<pre class="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">Failed to render diagram</pre>'
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [chart, stableId]);

  return (
    <div
      className="my-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
