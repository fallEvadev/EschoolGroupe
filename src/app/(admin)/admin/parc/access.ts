import "server-only";

import { redirect } from "next/navigation";

import { requireSpace } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/roles";

/** Rôles qui tiennent l'inventaire du parc informatique. */
export const MAINTENANCE_MANAGER_ROLES = [
  "admin_maintenance",
  "super_admin",
] as const;

/**
 * Second verrou de la page Parc : l'espace admin ne suffit pas, il faut être
 * Admin Maintenance ou Super-Admin (le premier verrou est dans `proxy.ts`).
 */
export async function requireMaintenanceManager(): Promise<Role> {
  const role = await requireSpace("admin");
  if (role !== "admin_maintenance" && role !== "super_admin") {
    redirect("/non-autorise");
  }
  return role;
}
