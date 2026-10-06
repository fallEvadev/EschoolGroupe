import "server-only";

import { redirect } from "next/navigation";

import { requireSpace } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/roles";

/**
 * Second verrou des pages Personnel : l'espace admin ne suffit pas, il faut
 * être Admin RH ou Super-Admin (le premier verrou est dans `proxy.ts`).
 */
export async function requireStaffManager(): Promise<Role> {
  const role = await requireSpace("admin");
  if (role !== "admin_rh" && role !== "super_admin") redirect("/non-autorise");
  return role;
}
