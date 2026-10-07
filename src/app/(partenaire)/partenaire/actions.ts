"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { checkSchoolPosition, haversineMeters } from "@/lib/attendance";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  directorPositionSchema,
  type SchoolResult,
} from "@/lib/validations/schools";

/** Code PostgreSQL « privilège insuffisant » (levé par `set_school_position`). */
const INSUFFICIENT_PRIVILEGE = "42501";
/** Code PostgreSQL « valeur invalide » (coordonnées ou précision refusées). */
const INVALID_PARAMETER = "22023";

const ERREUR_GENERIQUE: SchoolResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

/**
 * Le directeur enregistre la position de SON école, depuis son téléphone, une
 * fois sur place. La précision est revérifiée ici (le téléphone ne fait pas
 * foi) puis par la base. Le déplacement par rapport à l'ancienne position est
 * écrit dans l'audit : un changement important se remarque.
 */
export async function setSchoolPosition(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(["directeur_partenaire"]);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = directorPositionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Position invalide.",
    };
  }
  const { schoolId, latitude, longitude, accuracyM } = parsed.data;

  const check = checkSchoolPosition({
    status: "ok",
    latitude,
    longitude,
    accuracyM,
  });
  if (!check.ok) return { ok: false, message: check.message };

  try {
    // Client avec le jeton du directeur : la RLS ne lui montre que ses écoles.
    const supabase = await createServerSupabase();
    const { data: school } = await supabase
      .from("schools")
      .select("name, latitude, longitude")
      .eq("id", schoolId)
      .maybeSingle();
    if (!school) return { ok: false, message: "École introuvable." };

    // La fonction SQL vérifie elle-même que l'appelant est directeur de cette
    // école et n'ouvre que la position (pas le nom ni les autres réglages).
    const { error } = await supabase.rpc("set_school_position", {
      p_school_id: schoolId,
      p_latitude: check.latitude,
      p_longitude: check.longitude,
      p_accuracy_m: check.accuracyM,
    });
    if (error) {
      if (error.code === INSUFFICIENT_PRIVILEGE) {
        return {
          ok: false,
          message: "Vous n'êtes pas directeur de cette école.",
        };
      }
      if (error.code === INVALID_PARAMETER) {
        return { ok: false, message: error.message };
      }
      console.error("set_school_position :", error.message);
      return ERREUR_GENERIQUE;
    }

    const movedM =
      school.latitude !== null && school.longitude !== null
        ? Math.round(
            haversineMeters(
              { latitude: school.latitude, longitude: school.longitude },
              { latitude: check.latitude, longitude: check.longitude },
            ),
          )
        : null;
    await writeAudit({
      actorId: caller.actorId,
      action: "school_position_set",
      entity: "schools",
      entityId: schoolId,
      details: {
        name: school.name,
        source: "directeur",
        accuracy_m: check.accuracyM,
        moved_m: movedM,
      },
    });

    revalidatePath("/partenaire");
    revalidatePath("/admin/ecoles");
    return {
      ok: true,
      id: schoolId,
      message: "Position de l'école enregistrée. Merci.",
    };
  } catch (error) {
    console.error("setSchoolPosition :", error);
    return ERREUR_GENERIQUE;
  }
}
