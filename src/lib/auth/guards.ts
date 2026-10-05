import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { canAccess, parseRole, type Role, type SpaceKey } from "./roles";

/** Rôle de l'utilisateur connecté, lu dans le jeton Clerk (`user_role`). */
export async function getCurrentRole(): Promise<Role | null> {
  const { sessionClaims } = await auth();
  return parseRole(sessionClaims?.user_role);
}

/**
 * Second verrou, après le proxy : à appeler dans le layout de chaque espace.
 * Ne jamais compter sur le proxy seul (règle de double contrôle).
 */
export async function requireSpace(space: SpaceKey): Promise<Role> {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const role = await getCurrentRole();
  if (!role || !canAccess(role, space)) redirect("/non-autorise");
  return role;
}
