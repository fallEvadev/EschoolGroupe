/**
 * Classe les erreurs Supabase « attendues » pendant la mise en place
 * (liaison Clerk absente, migration non appliquée) pour afficher un message
 * clair au lieu d'une erreur technique.
 */
export type SupabaseIssue = "auth" | "migration" | "other";

/** Codes renvoyés quand une table n'existe pas encore. */
const MIGRATION_CODES = new Set(["PGRST205", "42P01"]);

export function classifySupabaseError(error: {
  code?: string;
  message: string;
}): SupabaseIssue {
  const code = error.code ?? "";
  // PGRST3xx : jeton refusé (ex. « No suitable key or wrong key type »).
  if (code.startsWith("PGRST3") || /no suitable key|jwt/i.test(error.message))
    return "auth";
  if (MIGRATION_CODES.has(code)) return "migration";
  return "other";
}

/** Ce que voit l'utilisateur : aucun terme technique. */
export const SUPABASE_ISSUE_MESSAGES: Record<SupabaseIssue, string> = {
  auth: "Le service n'est pas encore bien configuré. Contactez l'administrateur technique.",
  migration:
    "Cette fonction n'est pas encore disponible : la base de données n'est pas à jour. Contactez l'administrateur technique.",
  other: "Données indisponibles pour le moment. Réessayez dans un instant.",
};

/** Consigne pour la personne qui met en place la plateforme : écrite dans la console du serveur seulement. */
const SETUP_HINTS: Partial<Record<SupabaseIssue, string>> = {
  auth: "Supabase ne reconnaît pas la connexion Clerk : activer l'intégration Supabase dans Clerk, puis ajouter Clerk dans Supabase (Authentication → Sign In / Providers → Third-Party Auth).",
  migration:
    "Une table n'existe pas : appliquer les migrations sur Supabase (npx supabase db push).",
};

/**
 * Message à afficher pour une erreur Supabase. Le détail technique (et la
 * marche à suivre pour la configuration) va dans la console du serveur.
 */
export function describeSupabaseError(
  context: string,
  error: { code?: string; message: string },
): { issue: SupabaseIssue; message: string } {
  const issue = classifySupabaseError(error);
  // Les erreurs de configuration sont aussi écrites, avec leur consigne, pour
  // que le développeur sache quoi faire sans que l'utilisateur voie du jargon.
  console.error(`${context} :`, SETUP_HINTS[issue] ?? error.message);
  return { issue, message: SUPABASE_ISSUE_MESSAGES[issue] };
}
