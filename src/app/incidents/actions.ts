"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getCurrentRole } from "@/lib/auth/guards";
import { recordIncident } from "@/lib/incident-recorder";

const clientErrorSchema = z.object({
  message: z.string().max(1000),
  pathname: z
    .string()
    .max(300)
    .regex(/^\//, "Chemin invalide."),
});

/**
 * Signale une erreur survenue dans le navigateur (par exemple un composant qui
 * plante). Les erreurs du serveur n'ont pas besoin de ce chemin : Next.js les
 * transmet lui-même à `instrumentation.ts`. Réservé aux personnes connectées ;
 * le nombre d'incidents créés par heure est plafonné par la base.
 */
export async function reportClientError(input: unknown): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const parsed = clientErrorSchema.safeParse(input);
  if (!parsed.success) return;

  await recordIncident({
    source: "navigateur",
    routePath: parsed.data.pathname,
    requestPath: parsed.data.pathname,
    routeType: "client",
    error: new Error(parsed.data.message),
    userRole: await getCurrentRole(),
  });
}
