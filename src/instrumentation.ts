import type { Instrumentation } from "next";

/**
 * Appelé par Next.js à chaque erreur du serveur (affichage d'une page, action
 * d'un formulaire, route API) avec le VRAI message, le chemin de la page dans le
 * code et le code court (digest) affiché à l'utilisateur. On l'enregistre pour
 * le Super-Admin (page « Incidents » et cloche). Voir `incident-recorder.ts`.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // L'enregistrement utilise Supabase côté serveur : pas dans l'environnement « edge ».
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const header = request.headers["user-agent"];
  const userAgent = Array.isArray(header) ? header[0] : header;

  const { recordIncident } = await import("@/lib/incident-recorder");
  await recordIncident({
    source: "serveur",
    routePath: context.routePath,
    requestPath: request.path,
    routeType: context.routeType,
    error,
    userAgent,
  });
};
