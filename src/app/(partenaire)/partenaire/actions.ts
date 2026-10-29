"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { checkSchoolPosition, haversineMeters } from "@/lib/attendance";
import { clerkAccountExists, sendInvitation } from "@/lib/invitations";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  deputyInviteSchema,
  deputyRemoveSchema,
} from "@/lib/validations/deputies";
import {
  directorPositionSchema,
  type SchoolResult,
} from "@/lib/validations/schools";

/** Code PostgreSQL « privilège insuffisant » (levé par `set_school_position`). */
const INSUFFICIENT_PRIVILEGE = "42501";
/** Code PostgreSQL « valeur invalide » (coordonnées ou précision refusées). */
const INVALID_PARAMETER = "22023";

/** Valeur en double (adresse e-mail déjà utilisée) et règle métier refusée. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

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

/**
 * Le directeur invite un adjoint pour SON école (au plus 2). La base contrôle
 * que l'appelant est directeur de cette école, impose le rôle « directeur
 * partenaire » et la limite ; le serveur envoie ensuite l'invitation par e-mail.
 * Si l'envoi échoue, la fiche est retirée : pas d'invité orphelin.
 */
export async function inviteDeputy(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(["directeur_partenaire"]);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = deputyInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const { schoolId, fullName, email, phone } = parsed.data;

  try {
    if (await clerkAccountExists(email)) {
      return {
        ok: false,
        message:
          "Un compte existe déjà avec cette adresse e-mail. Contactez la Direction pédagogique.",
      };
    }

    const supabase = await createServerSupabase();
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();

    const { data: profileId, error } = await supabase.rpc("invite_deputy", {
      p_school_id: schoolId,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone ?? "",
    });
    if (error) {
      if (error.code === INSUFFICIENT_PRIVILEGE) {
        return {
          ok: false,
          message: "Seul le directeur de cette école peut inviter un adjoint.",
        };
      }
      if (error.code === INVALID_PARAMETER || error.code === CHECK_VIOLATION) {
        return { ok: false, message: error.message };
      }
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message: "Une fiche existe déjà avec cette adresse e-mail.",
        };
      }
      console.error("invite_deputy :", error.message);
      return ERREUR_GENERIQUE;
    }

    try {
      await sendInvitation(profileId, email, "directeur_partenaire", null, {
        asService: true,
      });
    } catch (sendError) {
      console.error("invitation adjoint :", sendError);
      await supabase.rpc("remove_deputy", {
        p_school_id: schoolId,
        p_profile_id: profileId,
      });
      return {
        ok: false,
        message:
          "L'invitation n'a pas pu être envoyée. Vérifiez l'adresse e-mail puis réessayez.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "deputy_invited",
      entity: "school_directors",
      entityId: schoolId,
      details: { school: school?.name ?? "", deputy: fullName },
    });
    revalidatePath("/partenaire");
    revalidatePath("/admin/ecoles");
    return {
      ok: true,
      id: profileId,
      message: `Invitation envoyée à ${email}. L'adjoint doit l'ouvrir pour créer son mot de passe.`,
    };
  } catch (error) {
    console.error("inviteDeputy :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Le directeur retire un adjoint. Le rattachement est archivé (rien n'est
 * supprimé) ; une invitation jamais ouverte est annulée chez Clerk.
 */
export async function removeDeputy(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(["directeur_partenaire"]);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = deputyRemoveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const { schoolId, profileId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const [{ data: school }, { data: deputies }] = await Promise.all([
      supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
      supabase.rpc("my_deputies"),
    ]);
    const deputy = deputies?.find(
      (row) => row.school_id === schoolId && row.profile_id === profileId,
    );

    const { data: invitationId, error } = await supabase.rpc("remove_deputy", {
      p_school_id: schoolId,
      p_profile_id: profileId,
    });
    if (error) {
      if (error.code === INSUFFICIENT_PRIVILEGE) {
        return {
          ok: false,
          message: "Seul le directeur de cette école peut retirer un adjoint.",
        };
      }
      if (error.code === "P0002") return { ok: false, message: error.message };
      console.error("remove_deputy :", error.message);
      return ERREUR_GENERIQUE;
    }

    if (invitationId) {
      const client = await clerkClient();
      await client.invitations
        .revokeInvitation(invitationId)
        .catch(() => undefined);
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "deputy_removed",
      entity: "school_directors",
      entityId: schoolId,
      details: { school: school?.name ?? "", deputy: deputy?.full_name ?? "" },
    });
    revalidatePath("/partenaire");
    revalidatePath("/admin/ecoles");
    return { ok: true, message: "Adjoint retiré." };
  } catch (error) {
    console.error("removeDeputy :", error);
    return ERREUR_GENERIQUE;
  }
}
