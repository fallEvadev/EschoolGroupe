import "server-only";

import { auth } from "@clerk/nextjs/server";

import { parseRole } from "./roles";

/**
 * Vérifie, dans une Server Action, que l'appelant est bien Super-Admin. Sans
 * cela, n'importe quel utilisateur connecté pourrait appeler l'action : le
 * contrôle de la page ne suffit pas (règle du double contrôle).
 */
export async function requireSuperAdmin(): Promise<
  { ok: true; actorId: string } | { ok: false; message: string }
> {
  const { userId, sessionClaims } = await auth();
  const role = parseRole(sessionClaims?.user_role);
  if (!userId || role !== "super_admin") {
    return { ok: false, message: "Action réservée au Super-Admin." };
  }
  return { ok: true, actorId: userId };
}
