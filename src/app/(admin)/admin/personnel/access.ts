import "server-only";

import { redirect } from "next/navigation";

import { requireSpace } from "@/lib/auth/guards";
import { assignableRoles, type Role } from "@/lib/auth/roles";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Message quand un Admin RH vise la fiche d'un administrateur. */
export const ADMIN_PROFILE_MESSAGE =
  "Le dossier des administrateurs est géré par le Super-Admin.";

/**
 * Second verrou des pages Personnel : l'espace admin ne suffit pas, il faut
 * être Admin RH ou Super-Admin (le premier verrou est dans `proxy.ts`).
 */
export async function requireStaffManager(): Promise<Role> {
  const role = await requireSpace("admin");
  if (role !== "admin_rh" && role !== "super_admin") redirect("/non-autorise");
  return role;
}

/**
 * L'appelant peut-il gérer le dossier (documents, note) de cette fiche ?
 * Même règle que la modification de la fiche : un Admin RH ne gère pas les
 * administrateurs. À appeler dans chaque Server Action, car masquer le panneau
 * ne suffit pas (règle du double contrôle).
 */
export async function checkProfileAccess(
  supabase: ServerSupabase,
  actor: Role,
  profileId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return "not_found";
  return assignableRoles(actor).includes(data.role) ? "ok" : "forbidden";
}
