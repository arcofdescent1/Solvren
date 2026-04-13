"use client";

/**
 * Shown when the active organization is marked `is_demo` (seeded demo workspace).
 */
export function DemoOrgBanner() {
  return (
    <div
      className="border-b border-amber-300/80 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      Demo workspace — data is synthetic. Nothing here is production customer information.
    </div>
  );
}
