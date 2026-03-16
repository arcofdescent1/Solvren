import type { SupabaseClient } from "@supabase/supabase-js";
import type { RevenueSurface } from "@/services/risk/exposureMultiplier";

export async function getSurfaceWeight(
  supabase: SupabaseClient,
  args: { domainKey: string; revenueSurface: RevenueSurface | string }
) {
  const surface = String(args.revenueSurface ?? "SUBSCRIPTION").toUpperCase();
  const { data, error } = await supabase
    .from("domain_surface_weights")
    .select("weight")
    .eq("domain_key", args.domainKey)
    .eq("revenue_surface", surface)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Number((data as { weight?: number } | null)?.weight ?? 1.2);
}
