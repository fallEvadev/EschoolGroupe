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

export const SUPABASE_ISSUE_MESSAGES: Record<SupabaseIssue, string> = {
  auth: "Supabase ne reconnaît pas encore la connexion Clerk. Il faut activer l'intégration Supabase dans Clerk, puis ajouter Clerk dans Supabase (Authentication → Sign In / Providers → Third-Party Auth).",
  migration:
    "Une table n'existe pas encore : les migrations doivent être appliquées sur Supabase (npx supabase db push).",
  other: "Données indisponibles pour le moment. Réessayez dans un instant.",
};

/**
 * Message à afficher pour une erreur Supabase. Seules les erreurs inattendues
 * sont écrites dans la console (les autres sont des étapes de configuration).
 */
export function describeSupabaseError(
  context: string,
  error: { code?: string; message: string },
): { issue: SupabaseIssue; message: string } {
  const issue = classifySupabaseError(error);
  if (issue === "other") console.error(`${context} :`, error.message);
  return { issue, message: SUPABASE_ISSUE_MESSAGES[issue] };
}
