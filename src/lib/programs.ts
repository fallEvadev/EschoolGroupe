import { monthOf } from "@/lib/dates";

/** Bucket privé des programmes mensuels (voir la migration). */
export const PROGRAMS_BUCKET = "monthly-programs";

/** Taille maximale d'un programme : 10 Mo (même limite que le bucket). */
export const MAX_PROGRAM_BYTES = 10 * 1024 * 1024;

/** Seul type accepté. */
export const PROGRAM_MIME_TYPE = "application/pdf";

/** Un programme publié, tel que l'affichent les listes. */
export type ProgramItem = {
  id: string;
  /** Mois concerné, « aaaa-mm ». */
  month: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  publishedAt: string;
  status: "actif" | "remplace";
};

/** Date stockée en base (« 2026-10-01 ») → mois (« 2026-10 »). */
export function programMonthFromDate(date: string): string {
  return monthOf(date);
}

/** Mois (« 2026-10 ») → date stockée en base (« 2026-10-01 »). */
export function programMonthToDate(month: string): string {
  return `${month}-01`;
}

/**
 * Chemin de stockage sûr : mois, identifiant unique, puis nom de fichier sans
 * accents ni caractères spéciaux.
 */
export function buildProgramPath(
  month: string,
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
      .slice(-80) || "programme.pdf";
  return `${month}/${uniqueId}-${safeName}`;
}

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Le chemin reçu a-t-il exactement la forme produite par `buildProgramPath`
 * pour ce mois (`<mois>/<uuid>-<nom sûr>`) ? Un simple test du début laisserait
 * passer n'importe quel suffixe venu du navigateur.
 */
export function isValidProgramPath(path: string, month: string): boolean {
  const prefix = `${month}/`;
  if (!path.startsWith(prefix)) return false;
  return new RegExp(`^${UUID_PATTERN}-[A-Za-z0-9._-]{1,80}$`, "i").test(
    path.slice(prefix.length),
  );
}

/** Un vrai PDF commence par « %PDF- » : le type annoncé par le navigateur ne prouve rien. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/** Titre proposé par défaut : « Programme de octobre 2026 ». */
export function defaultProgramTitle(monthLabel: string): string {
  return `Programme de ${monthLabel}`;
}

/**
 * Sépare les programmes en vigueur : celui du mois en cours, ceux à venir
 * (publiés à l'avance) et les précédents, du plus récent au plus ancien.
 */
export function splitPrograms(
  programs: readonly ProgramItem[],
  currentMonth: string,
): {
  current: ProgramItem | null;
  upcoming: ProgramItem[];
  previous: ProgramItem[];
} {
  const active = programs.filter((program) => program.status === "actif");
  const byMonthDesc = (a: ProgramItem, b: ProgramItem) =>
    b.month.localeCompare(a.month);
  return {
    current: active.find((program) => program.month === currentMonth) ?? null,
    upcoming: active
      .filter((program) => program.month > currentMonth)
      .sort(byMonthDesc),
    previous: active
      .filter((program) => program.month < currentMonth)
      .sort(byMonthDesc),
  };
}
