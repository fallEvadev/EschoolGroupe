/** Statuts d'un incident (même liste que la contrainte SQL). */
export const INCIDENT_STATUSES = ["nouveau", "en_cours", "resolu"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export function isIncidentStatus(value: string): value is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(value);
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  resolu: "Résolu",
};

export const INCIDENT_STATUS_BADGE: Record<
  IncidentStatus,
  "neutral" | "default" | "success" | "warning" | "destructive"
> = {
  nouveau: "destructive",
  en_cours: "warning",
  resolu: "success",
};

/** Les incidents à traiter d'abord : nouveaux, puis en cours, puis résolus. */
export function sortIncidents<
  T extends { status: IncidentStatus; lastSeenAt: string },
>(items: readonly T[]): T[] {
  const rank: Record<IncidentStatus, number> = {
    nouveau: 0,
    en_cours: 1,
    resolu: 2,
  };
  return [...items].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      b.lastSeenAt.localeCompare(a.lastSeenAt),
  );
}

const MAX_MESSAGE = 600;
const MAX_STACK = 2500;

/**
 * Masque ce qui ne doit jamais atterrir dans la table des incidents : adresses
 * e-mail, numéros de téléphone, jetons et longues clés. Les identifiants (UUID)
 * deviennent « <id> », ce qui aide aussi à regrouper les erreurs identiques.
 */
export function maskSensitive(text: string): string {
  return text
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jeton]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "<id>",
    )
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]")
    .replace(/(?:sk|pk|whsec|re)_[A-Za-z0-9_]{8,}/g, "[clé]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [jeton]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[numéro]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[secret]");
}

/** Message d'une erreur inconnue, nettoyé et borné. */
export function cleanMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Erreur sans message";
  const cleaned = maskSensitive(raw).replace(/\s+/g, " ").trim();
  return (cleaned || "Erreur sans message").slice(0, MAX_MESSAGE);
}

/** Début de la trace d'appels, nettoyé et borné ; `null` s'il n'y en a pas. */
export function cleanStack(error: unknown): string | null {
  if (!(error instanceof Error) || !error.stack) return null;
  return maskSensitive(error.stack).slice(0, MAX_STACK);
}

/** Adresse sans paramètres ni ancre, bornée (les paramètres peuvent contenir des données). */
export function stripQuery(path: string | undefined | null): string | null {
  if (!path) return null;
  const clean = path.split(/[?#]/)[0] ?? "";
  return clean ? clean.slice(0, 300) : null;
}

/** Hachage 53 bits (cyrb53), assez fin pour regrouper des erreurs identiques. */
function hash53(text: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * Empreinte d'une erreur : la page, le type et le message dont on a retiré les
 * nombres (« ligne 12 » et « ligne 48 » sont la même erreur). Deux erreurs
 * identiques sur la même page n'ouvrent qu'un seul incident.
 */
export function incidentFingerprint({
  routePath,
  routeType,
  message,
}: {
  routePath: string;
  routeType: string | null;
  message: string;
}): string {
  const stable = message.replace(/\d+/g, "#").toLowerCase();
  const key = `${routePath}|${routeType ?? ""}|${stable}`;
  return `${hash53(key, 1)}${hash53(key, 2)}`;
}

/**
 * Erreurs normales de Next.js (redirection, page introuvable) : ce ne sont pas
 * des bugs, on ne les enregistre pas.
 */
export function isExpectedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_NOT_FOUND") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}

/** Un incident tel que la page Incidents le manipule. */
export type IncidentView = {
  id: string;
  source: string;
  routePath: string;
  requestPath: string | null;
  routeType: string | null;
  message: string;
  digest: string | null;
  stack: string | null;
  userRole: string | null;
  userAgent: string | null;
  status: IncidentStatus;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  note: string | null;
};

/** Libellé du type d'événement. */
const ROUTE_TYPE_LABELS: Record<string, string> = {
  render: "affichage d'une page",
  route: "route de l'application (API ou téléchargement)",
  action: "action d'un formulaire ou d'un bouton",
  proxy: "contrôle d'accès (proxy)",
  client: "erreur dans le navigateur",
};

/**
 * Texte prêt à coller dans la conversation avec Claude : tout ce qu'il faut
 * pour retrouver le fichier et la cause, sans donnée personnelle.
 */
export function buildClaudeReport(
  incident: IncidentView,
  format: (iso: string) => string,
): string {
  const lines = [
    "Incident à analyser sur la plateforme E-School.",
    "",
    `Statut : ${INCIDENT_STATUS_LABELS[incident.status]} · vu ${incident.occurrences} fois`,
    `Première fois : ${format(incident.firstSeenAt)} · dernière fois : ${format(incident.lastSeenAt)} (heure de Dakar)`,
    `Origine : ${incident.source === "navigateur" ? "navigateur" : "serveur"}`,
    `Type : ${incident.routeType ? (ROUTE_TYPE_LABELS[incident.routeType] ?? incident.routeType) : "non précisé"}`,
    `Chemin de la page dans le code (src/app…) : ${incident.routePath}`,
    `Adresse visitée : ${incident.requestPath ?? "non précisée"}`,
    `Profil de la personne : ${incident.userRole ?? "inconnu"}`,
    `Appareil : ${incident.userAgent ?? "inconnu"}`,
    `Code affiché à l'écran (digest) : ${incident.digest ?? "aucun"}`,
    "",
    `Message : ${incident.message}`,
  ];
  if (incident.stack) {
    lines.push("", "Début de la trace :", incident.stack.slice(0, 1200));
  }
  lines.push(
    "",
    "Demande : retrouve le fichier et la cause probable, explique-moi le problème simplement, puis propose une correction sans supprimer de fonctionnalité.",
  );
  return lines.join("\n");
}
