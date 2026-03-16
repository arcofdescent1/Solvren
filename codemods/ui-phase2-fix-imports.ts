/**
 * Phase 2 codemod: Consolidate deep UI imports into @/ui barrel.
 * Run: npm run codemod:ui:phase2
 */
import type { API, FileInfo } from "jscodeshift";

export default function transform(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  if (file.path.includes("/src/ui/")) return file.source;

  const deep = root.find(j.ImportDeclaration).filter((p) => {
    const v = String(p.node.source.value);
    return (
      v.startsWith("@/ui/primitives/") ||
      v.startsWith("@/ui/layout/") ||
      v.startsWith("@/ui/navigation/") ||
      v.startsWith("@/ui/theme/")
    );
  });

  if (deep.size() === 0) return file.source;

  const names = new Set<string>();

  deep.forEach((p) => {
    (p.node.specifiers || []).forEach((s) => {
      if (s.type === "ImportSpecifier" && s.imported?.name) {
        names.add(s.imported.name);
      }
    });
    j(p).remove();
  });

  if (names.size === 0) return root.toSource({ quote: "double" });

  const uiImport = root.find(j.ImportDeclaration).filter((p) => p.node.source.value === "@/ui");

  if (uiImport.size() > 0) {
    uiImport.forEach((p) => {
      const specifiers = p.node.specifiers ?? [];
      const existing = new Set(
        specifiers
          .filter((s) => s.type === "ImportSpecifier")
          .map((s: { imported?: { name?: string } }) => s.imported?.name)
      );
      Array.from(names)
        .sort()
        .forEach((n) => {
          if (!existing.has(n)) {
            specifiers.push(j.importSpecifier(j.identifier(n)));
          }
        });
      p.node.specifiers = specifiers;
    });
  } else {
    const specifiers = Array.from(names)
      .sort()
      .map((n) => j.importSpecifier(j.identifier(n)));
    root.get().node.program.body.unshift(j.importDeclaration(specifiers, j.literal("@/ui")));
  }

  return root.toSource({ quote: "double" });
}
