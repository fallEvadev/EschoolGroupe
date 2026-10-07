import "server-only";

import { redirect } from "next/navigation";

import { requireSpace } from "@/lib/auth/guards";
import { parseRole, type Role } from "@/lib/auth/roles";
import { describeSupabaseError } from "@/lib/supabase/errors";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Rôles qui gèrent les écoles, les créneaux et les affectations. */
export const PEDAGOGY_ROLES = ["admin_pedagogie", "super_admin"] as const;

/**
 * Second verrou des pages Écoles : l'espace admin ne suffit pas, il faut être
 * Admin Pédagogie ou Super-Admin (le premier verrou est dans `proxy.ts`).
 */
export async function requirePedagogyManager(): Promise<Role> {
  const role = await requireSpace("admin");
  if (role !== "admin_pedagogie" && role !== "super_admin") {
    redirect("/non-autorise");
  }
  return role;
}

/** Une personne de l'annuaire minimal (nom, rôle, statut : rien d'autre). */
export type StaffMember = {
  id: string;
  fullName: string;
  role: Role;
  status: string;
};

/**
 * Formateurs et directeurs partenaires, via la fonction SQL
 * `pedagogy_staff_directory` : la Direction pédagogique ne peut pas lire
 * `profiles` (e-mail, téléphone, documents réservés aux RH).
 */
export async function loadStaffDirectory(
  supabase: ServerSupabase,
): Promise<{ staff: StaffMember[] } | { error: string }> {
  const { data, error } = await supabase.rpc("pedagogy_staff_directory");
  if (error) {
    return {
      error: describeSupabaseError("pedagogy_staff_directory", error).message,
    };
  }
  return {
    staff: data.flatMap((row) => {
      const role = parseRole(row.role);
      return role
        ? [{ id: row.id, fullName: row.full_name, role, status: row.status }]
        : [];
    }),
  };
}
