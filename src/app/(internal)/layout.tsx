import type { ReactNode } from "react";

export const runtime = "nodejs";

export async function headers() {
  return { "X-Robots-Tag": "noindex, nofollow" };
}

export default function InternalRouteGroupLayout({ children }: { children: ReactNode }) {
  return children;
}
