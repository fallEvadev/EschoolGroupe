/** Résultat d'un contrôle de santé de la plateforme. */
export type HealthReport = {
  ok: boolean;
  /** La base de données répond-elle ? */
  db: boolean;
  /** Durée du contrôle de la base, en millisecondes. */
  ms: number;
};

/** Au-delà de ce délai, la base est considérée comme injoignable. */
export const DB_TIMEOUT_MS = 5000;

/**
 * Vérifie que Supabase répond, avec la clé PUBLIQUE seulement : on appelle la
 * fonction `current_user_role`, qui ne renvoie rien de sensible sans connexion
 * mais traverse tout le chemin réseau + PostgREST + PostgreSQL. Aucune donnée
 * n'est lue ni écrite. Le résultat ne contient ni clé, ni adresse, ni message
 * d'erreur : la route est publique.
 */
export async function checkHealth({
  supabaseUrl,
  anonKey,
  fetchFn = fetch,
  timeoutMs = DB_TIMEOUT_MS,
  now = () => Date.now(),
}: {
  supabaseUrl: string | undefined;
  anonKey: string | undefined;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}): Promise<HealthReport> {
  const started = now();
  if (!supabaseUrl || !anonKey) {
    return { ok: false, db: false, ms: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/current_user_role`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const db = response.ok;
    return { ok: db, db, ms: now() - started };
  } catch {
    return { ok: false, db: false, ms: now() - started };
  } finally {
    clearTimeout(timer);
  }
}
