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

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** Taille lisible : 1 250 000 → « 1,2 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
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
