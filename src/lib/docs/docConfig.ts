export const DOCS_CONTENT_BASE = "content/docs";

/**
 * Update this to your actual repo edit URL when ready.
 * Example: https://github.com/your-org/solvren/edit/main/
 */
export const DOCS_EDIT_BASE_URL =
  process.env.NEXT_PUBLIC_DOCS_EDIT_BASE_URL ||
  "https://github.com/your-org/solvren/edit/main/";

/**
 * Update this to your issue/new discussion form if desired.
 */
export const DOCS_FEEDBACK_URL =
  process.env.NEXT_PUBLIC_DOCS_FEEDBACK_URL ||
  "mailto:docs@solvren.com";
