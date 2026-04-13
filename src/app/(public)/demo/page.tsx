import { redirect } from "next/navigation";

/**
 * Legacy marketing CTA path. "Book a Demo" previously linked here; there is no interactive demo page yet.
 */
export default function BookDemoRedirectPage() {
  redirect("/contact");
}
