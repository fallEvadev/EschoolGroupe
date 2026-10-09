import { getOfflineDb } from "@/lib/offline/db";
import { draftsToPurge, type ReportDraft } from "@/lib/offline/report-drafts";
import type { ReportContent } from "@/lib/reports";

/**
 * Accès au stockage local. Toutes les fonctions échouent en silence : si
 * IndexedDB est indisponible (navigation privée, stockage plein), le formulaire
 * continue de fonctionner, simplement sans copie locale.
 */

export async function saveLocalDraft(
  attendanceId: string,
  ownerId: string,
  content: ReportContent,
): Promise<void> {
  try {
    await getOfflineDb().report_drafts.put({
      attendanceId,
      ownerId,
      content,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.warn("Brouillon local non enregistré :", error);
  }
}

export async function loadLocalDraft(
  attendanceId: string,
): Promise<ReportDraft | undefined> {
  try {
    return await getOfflineDb().report_drafts.get(attendanceId);
  } catch (error) {
    console.warn("Brouillon local illisible :", error);
    return undefined;
  }
}

export async function deleteLocalDraft(attendanceId: string): Promise<void> {
  try {
    await getOfflineDb().report_drafts.delete(attendanceId);
  } catch (error) {
    console.warn("Brouillon local non supprimé :", error);
  }
}

/** Efface les brouillons expirés ou écrits par un autre compte. */
export async function purgeLocalDrafts(ownerId: string): Promise<void> {
  try {
    const table = getOfflineDb().report_drafts;
    const ids = draftsToPurge(await table.toArray(), ownerId, Date.now());
    if (ids.length > 0) await table.bulkDelete(ids);
  } catch (error) {
    console.warn("Nettoyage des brouillons locaux impossible :", error);
  }
}
