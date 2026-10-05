import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";

type AuditEntry = {
  /** Identifiant Clerk de l'auteur, `null` pour une action du système. */
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, string | number | boolean | null>;
};

/** Écrit une ligne dans le journal d'audit (ne bloque jamais l'action). */
export async function writeAudit({
  actorId,
  action,
  entity,
  entityId,
  details,
}: AuditEntry) {
  const { error } = await createAdminSupabase().from("audit_log").insert({
    actor_clerk_id: actorId,
    action,
    entity,
    entity_id: entityId,
    details,
  });
  if (error) console.error("audit_log :", error.message);
}
