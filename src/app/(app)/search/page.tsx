import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import SearchPageClient from "./SearchPageClient";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; system?: string; changeType?: string; domain?: string; types?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const params = await searchParams;
  return (
    <SearchPageClient
      initialQ={params.q ?? ""}
      initialStatus={params.status ?? ""}
      initialSystem={params.system ?? ""}
      initialChangeType={params.changeType ?? ""}
      initialDomain={params.domain ?? ""}
      initialTypes={params.types ?? ""}
    />
  );
}
