import "server-only";

import { auth } from "@clerk/nextjs/server";

import { parseRole, ROLE_LABELS, type Role } from "./roles";

type GuardResult =
  { ok: true; actorId: string; role: Role } | { ok: false; message: string };

/**
 * Vérifie, dans une Server Action, que l'appelant a l'un des rôles attendus.
 * Sans cela, n'importe quel utilisateur connecté pourrait appeler l'action :
 * le contrôle de la page ne suffit pas (règle du double contrôle).
 */
export async function requireActionRole(
  roles: readonly Role[],
): Promise<GuardResult> {
  const { userId, sessionClaims } = await auth();
  const role = parseRole(sessionClaims?.user_role);
  if (!userId || !role || !roles.includes(role)) {
    const labels = roles.map((r) => ROLE_LABELS[r]).join(" ou ");
    return { ok: false, message: `Action réservée : ${labels}.` };
  }
  return { ok: true, actorId: userId, role };
}

/** Raccourci pour les actions réservées au Super-Admin. */
export function requireSuperAdmin(): Promise<GuardResult> {
  return requireActionRole(["super_admin"]);
}
