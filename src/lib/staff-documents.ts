/** Bucket privé des documents du personnel (voir la migration). */
export const STAFF_DOCUMENTS_BUCKET = "staff-documents";

/** Taille maximale d'un fichier : 5 Mo (même limite que le bucket). */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Types de documents (mêmes valeurs que la contrainte SQL `kind`). */
export const DOCUMENT_KINDS = [
  "cv",
  "cni",
  "photo",
  "contrat",
  "diplome",
  "autre",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  cv: "CV",
  cni: "Pièce d'identité (CNI)",
  photo: "Photo",
  contrat: "Contrat signé",
  diplome: "Diplômes",
  autre: "Autre document",
};

/** Pièces obligatoires du dossier (cahier des charges : CV, CNI, photo). */
export const REQUIRED_DOCUMENT_KINDS: readonly DocumentKind[] = [
  "cv",
  "cni",
  "photo",
];

const PDF_AND_IMAGES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Formats acceptés par type de document. */
export const ACCEPTED_TYPES: Record<DocumentKind, readonly string[]> = {
  cv: PDF_AND_IMAGES,
  cni: PDF_AND_IMAGES,
  photo: IMAGES,
  contrat: PDF_AND_IMAGES,
  diplome: PDF_AND_IMAGES,
  autre: PDF_AND_IMAGES,
};

/** Contrôle d'une pièce (mêmes valeurs que la contrainte SQL `review_status`). */
export const REVIEW_STATUSES = ["a_verifier", "valide", "rejete"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  a_verifier: "À vérifier",
  valide: "Validé",
  rejete: "Rejeté",
};

export const REVIEW_BADGE: Record<
  ReviewStatus,
  "warning" | "success" | "destructive"
> = {
  a_verifier: "warning",
  valide: "success",
  rejete: "destructive",
};

export function isReviewStatus(value: string): value is ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(value);
}

/** Décisions possibles d'un contrôle (on ne « remet » pas une pièce à vérifier). */
export const REVIEW_DECISIONS = ["valide", "rejete"] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Un rejet doit être expliqué : la personne doit savoir quoi corriger. */
export function decisionNeedsReason(decision: ReviewDecision): boolean {
  return decision === "rejete";
}

/** Résumé du contrôle d'un dossier, calculé sur ses pièces en vigueur. */
export function reviewProgress(
  documents: readonly { kind: DocumentKind; reviewStatus: ReviewStatus }[],
): { requiredValidated: number; pending: number; rejected: number } {
  return {
    requiredValidated: REQUIRED_DOCUMENT_KINDS.filter((kind) =>
      documents.some(
        (doc) => doc.kind === kind && doc.reviewStatus === "valide",
      ),
    ).length,
    pending: documents.filter((doc) => doc.reviewStatus === "a_verifier")
      .length,
    rejected: documents.filter((doc) => doc.reviewStatus === "rejete").length,
  };
}

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** Taille lisible : 1 250 000 → « 1,2 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Un fichier de ce type, de ce format et de cette taille est-il acceptable ? */
export function isAcceptedFile(
  kind: DocumentKind,
  mimeType: string,
  size: number,
): boolean {
  return (
    ACCEPTED_TYPES[kind].includes(mimeType) &&
    Number.isInteger(size) &&
    size >= 1 &&
    size <= MAX_DOCUMENT_BYTES
  );
}

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Le chemin reçu est-il exactement de la forme produite par `buildStoragePath`
 * pour cette fiche et ce type (`<fiche>/<type>/<uuid>-<nom sûr>`) ? Un simple
 * test du début laisserait passer n'importe quel suffixe venu du navigateur.
 */
export function isValidStoragePath(
  path: string,
  profileId: string,
  kind: DocumentKind,
): boolean {
  const prefix = `${profileId}/${kind}/`;
  if (!path.startsWith(prefix)) return false;
  return new RegExp(`^${UUID_PATTERN}-[A-Za-z0-9._-]{1,80}$`, "i").test(
    path.slice(prefix.length),
  );
}

/**
 * Chemin de stockage sûr : dossier de la fiche, type, identifiant unique,
 * puis nom de fichier sans accents ni caractères spéciaux.
 */
export function buildStoragePath(
  profileId: string,
  kind: DocumentKind,
  fileName: string,
  uniqueId: string,
): string {
  const safeName =
    fileName
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-80) || "document";
  return `${profileId}/${kind}/${uniqueId}-${safeName}`;
}
