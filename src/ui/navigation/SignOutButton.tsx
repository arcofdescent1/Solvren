"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ children }: { children?: React.ReactNode }) {
  const router = useRouter();

  async function handleSignOut() {
    let logoutUrl: string | null = null;
    try {
      const res = await fetch("/api/auth/sso/logout-url");
      const data = (await res.json()) as { logoutUrl?: string | null };
      if (data.logoutUrl) logoutUrl = data.logoutUrl;
    } catch {
      // ignore
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    if (logoutUrl) {
      window.location.href = logoutUrl;
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="flex w-full items-center gap-2 rounded-[calc(var(--radius-md)-2px)] px-2 py-2 text-sm text-[var(--text)] outline-none transition-colors hover:bg-[var(--bg-surface-2)] focus:bg-[var(--bg-surface-2)]"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {children ?? "Logout"}
    </button>
  );
}
