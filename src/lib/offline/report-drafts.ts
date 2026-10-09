import type { ReportContent } from "@/lib/reports";

/** Un brouillon gardé sur le téléphone expire au bout de 14 jours. */
export const DRAFT_TTL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Brouillon de rapport conservé dans le navigateur (IndexedDB). Il est lié au
 * pointage ET au compte qui l'a écrit : un autre compte sur le même téléphone
 * ne le voit jamais.
 */
export type ReportDraft = {
  attendanceId: string;
  ownerId: string;
  content: ReportContent;
  /** Horodatage (ms) de la dernière modification locale. */
  updatedAt: number;
};

/** Contenu comparable : les espaces autour des textes ne comptent pas. */
function normalize(content: ReportContent) {
  return {
    classes: content.classes.trim(),
    courseTheme: content.courseTheme.trim(),
    equipmentOk: content.equipmentOk,
    issues: content.issues.map((issue) => ({
      equipment: issue.equipment.trim(),
      description: issue.description.trim(),
    })),
  };
}

export function sameContent(a: ReportContent, b: ReportContent): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function isExpired(draft: ReportDraft, now: number): boolean {
  return now - draft.updatedAt > DRAFT_TTL_DAYS * DAY_MS;
}

/**
 * Faut-il proposer ce brouillon local au formateur ? Oui s'il est à lui, pas
 * expiré, et différent de la version déjà enregistrée sur le serveur.
 */
export function shouldOfferDraft(
  draft: ReportDraft | undefined,
  ownerId: string,
  serverContent: ReportContent,
  now: number,
): draft is ReportDraft {
  if (!draft) return false;
  if (draft.ownerId !== ownerId) return false;
  if (isExpired(draft, now)) return false;
  return !sameContent(draft.content, serverContent);
}

/**
 * Faut-il écrire la saisie en local ? Non si elle est identique à la version du
 * serveur (rien à protéger), pour ne pas encombrer le téléphone.
 */
export function shouldSaveDraft(
  content: ReportContent,
  serverContent: ReportContent,
): boolean {
  return !sameContent(content, serverContent);
}

/** Brouillons à effacer : expirés, ou écrits par un autre compte. */
export function draftsToPurge(
  drafts: ReportDraft[],
  ownerId: string,
  now: number,
): string[] {
  return drafts
    .filter((d) => d.ownerId !== ownerId || isExpired(d, now))
    .map((d) => d.attendanceId);
}
