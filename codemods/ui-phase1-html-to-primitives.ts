/**
 * Phase 1 codemod: Replace raw HTML elements with design system primitives.
 * Run: npm run codemod:ui:phase1
 */
import type { API, FileInfo } from "jscodeshift";

const TAG_MAP: Record<string, string> = {
  button: "Button",
  input: "Input",
  select: "NativeSelect",
  textarea: "Textarea",
  table: "Table",
};

const UI_IMPORT = "@/ui";

export default function transform(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  if (file.path.includes("/src/ui/")) return file.source;

  const used = new Set<string>();

  Object.entries(TAG_MAP).forEach(([from, to]) => {
    root
      .find(j.JSXOpeningElement, { name: { type: "JSXIdentifier", name: from } })
      .forEach(() => {
        used.add(to);
      });
    root
      .find(j.JSXClosingElement, { name: { type: "JSXIdentifier", name: from } })
      .forEach(() => {
        used.add(to);
      });
  });

  if (used.size === 0) return file.source;

  Object.entries(TAG_MAP).forEach(([from, to]) => {
    root
      .find(j.JSXOpeningElement, { name: { type: "JSXIdentifier", name: from } })
      .forEach((p) => {
        p.node.name = j.jsxIdentifier(to);
      });
    root
      .find(j.JSXClosingElement, { name: { type: "JSXIdentifier", name: from } })
      .forEach((p) => {
        p.node.name = j.jsxIdentifier(to);
      });
  });

  const importDecls = root.find(j.ImportDeclaration);
  const existing = importDecls.filter((p) => p.node.source.value === UI_IMPORT);

  if (existing.size() > 0) {
    existing.forEach((p) => {
      const specifiers = p.node.specifiers ?? [];
      const existingNames = new Set(
        specifiers
          .filter((s) => s.type === "ImportSpecifier")
          .map((s: { imported?: { name?: string } }) => s.imported?.name)
      );
      used.forEach((name) => {
        if (!existingNames.has(name)) {
          specifiers.push(j.importSpecifier(j.identifier(name)));
        }
      });
      p.node.specifiers = specifiers;
    });
  } else {
    const specifiers = Array.from(used)
      .sort()
      .map((n) => j.importSpecifier(j.identifier(n)));
    const newImport = j.importDeclaration(specifiers, j.literal(UI_IMPORT));
    const firstImport = importDecls.at(0);
    if (firstImport.size() > 0) firstImport.insertBefore(newImport);
    else root.get().node.program.body.unshift(newImport);
  }

  return root.toSource({ quote: "double" });
}
