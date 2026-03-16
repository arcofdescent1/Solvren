import { DOCS_FEEDBACK_URL } from "./docConfig";
import type { DocItem } from "./docTypes";

export function getDocFeedbackUrl(doc: DocItem): string {
  const s = encodeURIComponent("Solvren Docs Feedback: " + doc.frontmatter.title);
  const b = encodeURIComponent("Page: " + doc.href + "\n\nFeedback:\n");
  return DOCS_FEEDBACK_URL.startsWith("mailto:") ? DOCS_FEEDBACK_URL + "?subject=" + s + "&body=" + b : DOCS_FEEDBACK_URL;
}
