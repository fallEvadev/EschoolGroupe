import "server-only";

import { getCurrentRules } from "@/lib/internal-rules";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createServerSupabase } from "@/lib/supabase/server";

export type MyProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  jobTitle: string | null;
  contractType: string | null;
  hireDate: string | null;
  status: string;
  /** Version du règlement en vigueur et date d'acceptation (null si pas encore acceptée). */
  rules: { version: number; acceptedAt: string | null } | null;
};

/**
 * Fiche de la personne connectée, lue avec SON jeton : la RLS ne lui montre
 * que sa propre fiche. Les documents du dossier (CV, CNI…) ne sont jamais lus
 * ici : ils restent réservés aux RH.
 */
export async function loadMyProfile(
  clerkUserId: string,
): Promise<MyProfile | null | { error: string }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, job_title, contract_type, hire_date, status",
    )
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) return { error: describeSupabaseError("profiles", error).message };
  if (!data) return null;

  let rules: MyProfile["rules"] = null;
  try {
    const current = await getCurrentRules();
    if (current) {
      const { data: acceptance } = await supabase
        .from("document_acceptances")
        .select("accepted_at")
        .eq("rules_id", current.id)
        .eq("profile_id", data.id)
        .maybeSingle();
      rules = {
        version: current.version,
        acceptedAt: acceptance?.accepted_at ?? null,
      };
    }
  } catch (cause) {
    // Le règlement est une information en plus : son absence ne bloque pas le profil.
    console.error("règlement du profil :", cause);
  }

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    jobTitle: data.job_title,
    contractType: data.contract_type,
    hireDate: data.hire_date,
    status: data.status,
    rules,
  };
}
