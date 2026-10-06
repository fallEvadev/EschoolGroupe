import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  canAccess,
  canAccessPath,
  parseRole,
  spaceForPath,
} from "@/lib/auth/roles";

/** Routes accessibles sans connexion. */
const isPublicRoute = createRouteMatcher([
  "/connexion(.*)",
  "/activation(.*)", // activation du compte après invitation RH
  "/non-autorise",
  "/charte", // aperçu temporaire de la charte graphique
  "/api/webhooks(.*)", // webhooks signés (Clerk, WhatsApp)
]);

/**
 * Premier verrou : connexion obligatoire, puis rôle exigé par espace.
 * Le second verrou est dans chaque layout (`requireSpace`) et dans les politiques RLS.
 */
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const space = spaceForPath(req.nextUrl.pathname);
  if (!space) return; // ex. "/" : la page redirige selon le rôle

  const role = parseRole(sessionClaims?.user_role);
  if (!canAccess(role, space) || !canAccessPath(role, req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/non-autorise", req.url));
  }
});

export const config = {
  matcher: [
    // Ignore les fichiers internes de Next.js et les fichiers statiques
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Toujours exécuter pour les routes API
    "/(api|trpc)(.*)",
  ],
};
