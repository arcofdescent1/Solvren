export const DOCS_CONTENT_BASE = "content/docs";

/**
 * Edit URL base for docs. Links to the repo edit view.
 */
export const DOCS_EDIT_BASE_URL =
  process.env.NEXT_PUBLIC_DOCS_EDIT_BASE_URL ||
  "https://github.com/arcofdescent1/Solvren/edit/main/";

/**
 * Feedback URL for docs. Used in page actions.
 */
export const DOCS_FEEDBACK_URL =
  process.env.NEXT_PUBLIC_DOCS_FEEDBACK_URL ||
  "mailto:support@solvren.com?subject=Docs%20Feedback";
