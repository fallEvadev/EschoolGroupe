/**
 * Adresse publique de l'application (sans barre finale), pour les liens qui
 * quittent le site comme celui de l'invitation.
 *
 * Priorité à `NEXT_PUBLIC_APP_URL` : une valeur fixe que personne ne peut
 * influencer. À défaut, on reconstruit l'adresse depuis les en-têtes de la
 * requête (pratique en local, mais ces en-têtes viennent de l'extérieur : en
 * production, définir la variable).
 */
export function resolveAppUrl({
  configured,
  host,
  forwardedProto,
}: {
  configured?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
}): string {
  const fixed = parseOrigin(configured);
  if (fixed) return fixed;

  const hostname = host?.trim();
  if (!hostname) throw new Error("Adresse de l'application introuvable.");
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${hostname}`;
}

/** Origine (`https://exemple.sn`) d'une adresse http(s) valide, sinon `null`. */
function parseOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
