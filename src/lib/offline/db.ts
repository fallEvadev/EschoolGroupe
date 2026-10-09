import Dexie, { type EntityTable } from "dexie";

import type { ReportDraft } from "@/lib/offline/report-drafts";

type OfflineDb = Dexie & {
  report_drafts: EntityTable<ReportDraft, "attendanceId">;
};

let db: OfflineDb | null = null;

/**
 * Base locale du navigateur (IndexedDB). Créée à la demande, jamais côté
 * serveur. `ownerId` est indexé pour purger les brouillons d'un autre compte.
 */
export function getOfflineDb(): OfflineDb {
  if (db) return db;
  const created = new Dexie("eschool-offline") as OfflineDb;
  created.version(1).stores({
    report_drafts: "attendanceId, ownerId, updatedAt",
  });
  db = created;
  return created;
}
