import { isStaffStatus, type StaffStatus } from "@/lib/staff";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";
import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;

/** Onglets de filtre de l'annuaire. */
export const FILTERS = [
  { key: "tous", label: "Tous", statuses: null },
  { key: "actifs", label: "Actifs", statuses: ["actif"] },
  { key: "invites", label: "Invités", statuses: ["invite"] },
  { key: "inactifs", label: "Inactifs", statuses: ["inactif", "archive"] },
] as const satisfies readonly {
  key: string;
  label: string;
  statuses: readonly StaffStatus[] | null;
}[];

export type FilterKey = (typeof FILTERS)[number]["key"];

/** Texte comparable : minuscules et sans accents (« Aïssatou » = « aissatou »). */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function statusOf(profile: Profile): StaffStatus {
  return isStaffStatus(profile.status) ? profile.status : "inactif";
}

/** Adresse de la page en gardant la recherche et le filtre en cours. */
export function personnelHref(params: {
  q?: string;
  filtre?: FilterKey;
  fiche?: string;
  /** Ne montrer que les personnes ayant des pièces à vérifier. */
  docs?: boolean;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.filtre && params.filtre !== "tous")
    search.set("filtre", params.filtre);
  if (params.docs) search.set("docs", "a-verifier");
  if (params.fiche) search.set("fiche", params.fiche);
  const query = search.toString();
  return query ? `/admin/personnel?${query}` : "/admin/personnel";
}

export async function loadProfiles(): Promise<
  { profiles: Profile[]; pendingProfileIds: string[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
    };
  }
  // Client avec le jeton de l'utilisateur : la RLS limite la lecture aux RH.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .limit(500);
  if (error) return { error: describeSupabaseError("profiles", error).message };

  // Personnes ayant au moins une pièce en vigueur à contrôler. Si cette
  // requête échoue (migration pas encore appliquée), la page reste utilisable
  // sans le filtre « Pièces à vérifier ».
  const { data: pending, error: pendingError } = await supabase
    .from("staff_documents")
    .select("profile_id")
    .eq("status", "actif")
    .eq("review_status", "a_verifier")
    .limit(2000);
  if (pendingError) describeSupabaseError("staff_documents", pendingError);

  return {
    profiles: data,
    pendingProfileIds: [...new Set((pending ?? []).map((d) => d.profile_id))],
  };
}
