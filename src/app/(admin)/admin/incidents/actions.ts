"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth/action-guard";
import { recordIncident } from "@/lib/incident-recorder";
import { INCIDENT_STATUSES } from "@/lib/incidents";
import { createServerSupabase } from "@/lib/supabase/server";

const statusSchema = z.object({
  id: z.uuid("Incident invalide."),
  status: z.enum(INCIDENT_STATUSES, { message: "Statut invalide." }),
});

export type IncidentResult = { ok: boolean; message: string };

/**
 * Change le statut d'un incident (nouveau, en cours, résolu). Écrit avec le
 * jeton du Super-Admin : la RLS et les droits de colonnes de la base ne lui
 * laissent modifier que le suivi, jamais le contenu de l'incident.
 */
export async function setIncidentStatus(
  input: unknown,
): Promise<IncidentResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { id, status } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const resolved = status === "resolu";
    const { data, error } = await supabase
      .from("incident_reports")
      .update({
        status,
        // La base exige une date de résolution si, et seulement si, « résolu ».
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? caller.actorId : null,
      })
      .eq("id", id)
      .select("id");
    if (error) {
      console.error("incident_reports :", error.message);
      return {
        ok: false,
        message: "Une erreur est survenue. Réessayez dans un instant.",
      };
    }
    if (!data || data.length === 0) {
      return { ok: false, message: "Incident introuvable." };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "incident_status_changed",
      entity: "incident_reports",
      entityId: id,
      details: { status },
    });

    revalidatePath("/admin/incidents");
    return { ok: true, message: "Statut mis à jour." };
  } catch (error) {
    console.error("setIncidentStatus :", error);
    return {
      ok: false,
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
}

/**
 * Envoie un incident de test : il suit exactement le chemin d'une vraie erreur
 * (enregistrement, regroupement, notification dans la cloche, ligne dans la
 * liste). Sert à vérifier que la surveillance fonctionne. Le mot aléatoire du
 * message en fait un incident distinct à chaque essai, donc toujours notifié.
 */
export async function sendTestIncident(): Promise<IncidentResult> {
  const caller = await requireSuperAdmin();
  if (!caller.ok) return { ok: false, message: caller.message };

  const word = Math.random().toString(36).replace(/[0-9.]/g, "").slice(0, 6);
  await recordIncident({
    source: "serveur",
    routePath: "/test/alerte",
    requestPath: "/admin/incidents",
    routeType: "test",
    error: new Error(`Incident de test envoyé par le Super-Admin (${word})`),
    userRole: "super_admin",
  });

  revalidatePath("/admin/incidents");
  return {
    ok: true,
    message:
      "Incident de test envoyé. Il doit apparaître dans la liste, et la cloche doit recevoir une notification dans la minute.",
  };
}
