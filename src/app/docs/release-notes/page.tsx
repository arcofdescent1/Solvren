import { redirect } from "next/navigation";

/**
 * Footer and external links may use /docs/release-notes; canonical docs path is /docs/releases.
 */
export default function DocsReleaseNotesAliasPage() {
  redirect("/docs/releases");
}
