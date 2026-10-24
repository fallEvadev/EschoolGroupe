import "server-only";

import {
  cleanMessage,
  cleanStack,
  incidentFingerprint,
  isExpectedError,
  stripQuery,
} from "@/lib/incidents";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Enregistre une erreur de la plateforme dans la table des incidents (voir la
 * migration `incident_reports`). Appelé par `instrumentation.ts` pour les erreurs
 * du serveur et par l'action `reportClientError` pour celles du navigateur.
 *
 * Règles :
 *  - ne lève JAMAIS d'erreur : surveiller ne doit pas casser le site ;
 *  - ignore les redirections et « page introuvable » (pas des bugs) ;
 *  - masque e-mails, téléphones et jetons avant d'écrire ;
 *  - écrit avec la clé de service, seul droit d'appeler `record_incident`.
 */
export async function recordIncident({
  source,
  routePath,
  requestPath,
  routeType,
  error,
  userRole,
  userAgent,
}: {
  source: "serveur" | "navigateur";
  routePath: string;
  requestPath?: string | null;
  routeType?: string | null;
  error: unknown;
  userRole?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    if (isExpectedError(error)) return;

    const message = cleanMessage(error);
    const route = routePath.slice(0, 300) || "/";
    const type = routeType ?? null;
    const digest =
      typeof error === "object" &&
      error !== null &&
      typeof (error as { digest?: unknown }).digest === "string"
        ? String((error as { digest: string }).digest)
        : null;

    const { error: rpcError } = await createAdminSupabase().rpc(
      "record_incident",
      {
        p_fingerprint: incidentFingerprint({
          routePath: route,
          routeType: type,
          message,
        }),
        p_source: source,
        p_route_path: route,
        // La fonction SQL exige les 10 paramètres : une valeur absente part en
        // `null` (et non `undefined`, que le client omettrait, ce qui ferait
        // introuvable la fonction côté PostgREST).
        p_request_path: stripQuery(requestPath),
        p_route_type: type,
        p_message: message,
        p_digest: digest,
        p_stack: cleanStack(error),
        p_user_role: userRole ?? null,
        p_user_agent: userAgent?.slice(0, 300) ?? null,
      },
    );
    if (rpcError) {
      console.warn("Incident non enregistré :", rpcError.message);
    }
  } catch (failure) {
    console.warn(
      "Incident non enregistré :",
      failure instanceof Error ? failure.message : failure,
    );
  }
}
