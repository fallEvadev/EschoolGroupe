"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { findOverlap, formatSlot } from "@/lib/schools";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  assignmentIdSchema,
  assignmentSchema,
  directorLinkSchema,
  schoolIdSchema,
  schoolPositionSchema,
  schoolSchema,
  schoolStatusSchema,
  slotIdSchema,
  slotSchema,
  type SchoolResult,
} from "@/lib/validations/schools";

import { loadStaffDirectory, PEDAGOGY_ROLES } from "./access";

/** Code PostgreSQL d'une valeur en double. */
const UNIQUE_VIOLATION = "23505";

const ERREUR_GENERIQUE: SchoolResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

function invalid(error: { issues: { message: string }[] }): SchoolResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Données invalides.",
  };
}

function refresh() {
  revalidatePath("/admin/ecoles");
}

/** Crée une école (nom, adresse, position, rayon, tolérance de retard). */
export async function createSchool(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = schoolSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  try {
    // Client avec le jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const { data: created, error } = await supabase
      .from("schools")
      // Pas de position ni de rayon ici : le directeur enregistre la position
      // sur place, et le rayon garde sa valeur par défaut en base (150 m).
      .insert({
        name: data.name,
        address: data.address,
        late_tolerance_minutes: data.lateToleranceMinutes,
        created_by: caller.actorId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: false, message: "Une école active porte déjà ce nom." };
      }
      console.error("schools :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "school_created",
      entity: "schools",
      entityId: created.id,
      details: { name: data.name },
    });
    refresh();
    return { ok: true, id: created.id, message: "École créée." };
  } catch (error) {
    console.error("createSchool :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Modifie les informations d'une école. */
export async function updateSchool(
  schoolId: string,
  input: unknown,
): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const id = schoolIdSchema.safeParse({ schoolId });
  if (!id.success) return invalid(id.error);
  const parsed = schoolSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("schools")
      // La position et le rayon ne figurent pas ici : modifier le nom d'une
      // école ne doit jamais effacer la position déjà enregistrée.
      .update({
        name: data.name,
        address: data.address,
        late_tolerance_minutes: data.lateToleranceMinutes,
      })
      .eq("id", id.data.schoolId)
      .select("id");
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: false, message: "Une école active porte déjà ce nom." };
      }
      console.error("schools :", error.message);
      return ERREUR_GENERIQUE;
    }
    // Refus de la RLS : aucune erreur, mais aucune ligne modifiée.
    if (updated.length === 0) {
      return { ok: false, message: "Vous ne pouvez pas modifier cette école." };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "school_updated",
      entity: "schools",
      entityId: id.data.schoolId,
      details: { name: data.name },
    });
    refresh();
    return { ok: true, id: id.data.schoolId, message: "École mise à jour." };
  } catch (error) {
    console.error("updateSchool :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Saisie manuelle de la position d'une école par la Direction pédagogique. C'est
 * un secours : le plus simple est que le directeur l'enregistre sur place depuis
 * son téléphone. L'ancienne position, s'il y en a une, est remplacée.
 */
export async function setSchoolPositionManual(
  input: unknown,
): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = schoolPositionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { schoolId, latitude, longitude } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("schools")
      .update({
        latitude,
        longitude,
        position_source: "admin",
        position_set_at: new Date().toISOString(),
        position_set_by: caller.actorId,
        // Saisie à la main : aucune précision de GPS à garder.
        position_accuracy_m: null,
      })
      .eq("id", schoolId)
      .select("name");
    if (error) {
      console.error("schools :", error.message);
      return ERREUR_GENERIQUE;
    }
    const school = updated[0];
    if (!school) {
      return { ok: false, message: "Vous ne pouvez pas modifier cette école." };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "school_position_set",
      entity: "schools",
      entityId: schoolId,
      details: { name: school.name, source: "admin" },
    });
    refresh();
    return {
      ok: true,
      id: schoolId,
      message: "Position de l'école enregistrée.",
    };
  } catch (error) {
    console.error("setSchoolPositionManual :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Archive ou restaure une école (aucune suppression). */
export async function setSchoolStatus(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = schoolStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { schoolId, status } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("schools")
      .update({ status })
      .eq("id", schoolId)
      .select("id, name");
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message:
            "Une autre école active porte déjà ce nom : renommez-la d'abord.",
        };
      }
      console.error("schools :", error.message);
      return ERREUR_GENERIQUE;
    }
    const school = updated[0];
    if (!school) {
      return { ok: false, message: "Vous ne pouvez pas modifier cette école." };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: status === "archive" ? "school_archived" : "school_restored",
      entity: "schools",
      entityId: schoolId,
      details: { name: school.name },
    });
    refresh();
    return {
      ok: true,
      message: status === "archive" ? "École archivée." : "École restaurée.",
    };
  } catch (error) {
    console.error("setSchoolStatus :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Rattache un directeur partenaire à une école. */
export async function addDirector(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = directorLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { schoolId, profileId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const directory = await loadStaffDirectory(supabase);
    if ("error" in directory) return { ok: false, message: directory.error };
    const director = directory.staff.find(
      (person) =>
        person.id === profileId &&
        person.role === "directeur_partenaire" &&
        person.status === "actif",
    );
    if (!director) {
      return {
        ok: false,
        message: "Cette personne n'est pas un directeur partenaire actif.",
      };
    }

    // Un directeur déjà rattaché puis retiré est simplement réactivé.
    const { error } = await supabase
      .from("school_directors")
      .upsert(
        { school_id: schoolId, profile_id: profileId, status: "actif" },
        { onConflict: "school_id,profile_id" },
      );
    if (error) {
      console.error("school_directors :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "director_linked",
      entity: "schools",
      entityId: schoolId,
      details: { director: director.fullName },
    });
    refresh();
    return {
      ok: true,
      message: `${director.fullName} est rattaché à l'école.`,
    };
  } catch (error) {
    console.error("addDirector :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Retire un directeur d'une école (le rattachement est archivé). */
export async function removeDirector(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = directorLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { schoolId, profileId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("school_directors")
      .update({ status: "archive" })
      .eq("school_id", schoolId)
      .eq("profile_id", profileId)
      .eq("status", "actif")
      .select("profile_id");
    if (error) {
      console.error("school_directors :", error.message);
      return ERREUR_GENERIQUE;
    }
    if (updated.length === 0) {
      return { ok: false, message: "Ce rattachement n'existe plus." };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "director_unlinked",
      entity: "schools",
      entityId: schoolId,
      details: { profile_id: profileId },
    });
    refresh();
    return { ok: true, message: "Directeur retiré de l'école." };
  } catch (error) {
    console.error("removeDirector :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Ajoute un créneau hebdomadaire à une école (sans chevauchement). */
export async function addSlot(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { schoolId, weekday, startsAt, endsAt, label } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: school } = await supabase
      .from("schools")
      .select("name, status")
      .eq("id", schoolId)
      .maybeSingle();
    if (!school) return { ok: false, message: "École introuvable." };
    if (school.status !== "actif") {
      return {
        ok: false,
        message: "Restaurez l'école avant d'ajouter un créneau.",
      };
    }

    const { data: existing, error: existingError } = await supabase
      .from("time_slots")
      .select("weekday, starts_at, ends_at, label")
      .eq("school_id", schoolId)
      .eq("weekday", weekday)
      .eq("status", "actif");
    if (existingError) {
      console.error("time_slots :", existingError.message);
      return ERREUR_GENERIQUE;
    }
    const clash = findOverlap(
      { weekday, startsAt, endsAt },
      existing.map((slot) => ({
        weekday: slot.weekday,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        label: slot.label,
      })),
    );
    if (clash) {
      return {
        ok: false,
        message: `Ce créneau chevauche un créneau existant : ${formatSlot(clash)}.`,
      };
    }

    const { data: created, error } = await supabase
      .from("time_slots")
      .insert({
        school_id: schoolId,
        weekday,
        starts_at: startsAt,
        ends_at: endsAt,
        label,
      })
      .select("id")
      .single();
    if (error) {
      console.error("time_slots :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "slot_created",
      entity: "time_slots",
      entityId: created.id,
      details: {
        school: school.name,
        slot: formatSlot({ weekday, startsAt, endsAt, label }),
      },
    });
    refresh();
    return { ok: true, id: created.id, message: "Créneau ajouté." };
  } catch (error) {
    console.error("addSlot :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Archive un créneau et ses affectations (rien n'est supprimé). */
export async function archiveSlot(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = slotIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { slotId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("time_slots")
      .update({ status: "archive" })
      .eq("id", slotId)
      .eq("status", "actif")
      .select("weekday, starts_at, ends_at, label");
    if (error) {
      console.error("time_slots :", error.message);
      return ERREUR_GENERIQUE;
    }
    const slot = updated[0];
    if (!slot) return { ok: false, message: "Ce créneau n'existe plus." };

    const { error: assignmentsError } = await supabase
      .from("slot_assignments")
      .update({ status: "archive" })
      .eq("slot_id", slotId)
      .eq("status", "actif");
    if (assignmentsError) {
      console.error("slot_assignments :", assignmentsError.message);
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "slot_archived",
      entity: "time_slots",
      entityId: slotId,
      details: {
        slot: formatSlot({
          weekday: slot.weekday,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          label: slot.label,
        }),
      },
    });
    refresh();
    return { ok: true, message: "Créneau archivé." };
  } catch (error) {
    console.error("archiveSlot :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Affecte un formateur à un créneau (sans chevauchement avec ses autres créneaux). */
export async function assignFormateur(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { slotId, profileId } = parsed.data;

  try {
    const supabase = await createServerSupabase();

    const { data: slot } = await supabase
      .from("time_slots")
      .select("school_id, weekday, starts_at, ends_at, label, status")
      .eq("id", slotId)
      .maybeSingle();
    if (!slot || slot.status !== "actif") {
      return { ok: false, message: "Créneau introuvable." };
    }

    const directory = await loadStaffDirectory(supabase);
    if ("error" in directory) return { ok: false, message: directory.error };
    const formateur = directory.staff.find(
      (person) =>
        person.id === profileId &&
        person.role === "formateur" &&
        person.status === "actif",
    );
    if (!formateur) {
      return {
        ok: false,
        message: "Cette personne n'est pas un formateur actif.",
      };
    }

    // Un formateur ne peut pas être à deux endroits à la même heure.
    const { data: mine } = await supabase
      .from("slot_assignments")
      .select("slot_id")
      .eq("profile_id", profileId)
      .eq("status", "actif");
    const slotIds = (mine ?? []).map((row) => row.slot_id);
    if (slotIds.length > 0) {
      const { data: others } = await supabase
        .from("time_slots")
        .select("weekday, starts_at, ends_at, label")
        .in("id", slotIds)
        .eq("status", "actif");
      const clash = findOverlap(
        {
          weekday: slot.weekday,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
        },
        (others ?? []).map((other) => ({
          weekday: other.weekday,
          startsAt: other.starts_at,
          endsAt: other.ends_at,
          label: other.label,
        })),
      );
      if (clash) {
        return {
          ok: false,
          message: `${formateur.fullName} a déjà un créneau à ce moment-là : ${formatSlot(clash)}.`,
        };
      }
    }

    const { data: created, error } = await supabase
      .from("slot_assignments")
      .insert({ slot_id: slotId, profile_id: profileId })
      .select("id")
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message: `${formateur.fullName} est déjà affecté à ce créneau.`,
        };
      }
      console.error("slot_assignments :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "slot_assigned",
      entity: "time_slots",
      entityId: slotId,
      details: {
        formateur: formateur.fullName,
        slot: formatSlot({
          weekday: slot.weekday,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          label: slot.label,
        }),
      },
    });
    refresh();
    return {
      ok: true,
      id: created.id,
      message: `${formateur.fullName} est affecté au créneau.`,
    };
  } catch (error) {
    console.error("assignFormateur :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Retire un formateur d'un créneau (l'affectation est archivée). */
export async function unassignFormateur(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = assignmentIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { assignmentId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("slot_assignments")
      .update({ status: "archive" })
      .eq("id", assignmentId)
      .eq("status", "actif")
      .select("slot_id, profile_id");
    if (error) {
      console.error("slot_assignments :", error.message);
      return ERREUR_GENERIQUE;
    }
    const assignment = updated[0];
    if (!assignment)
      return { ok: false, message: "Cette affectation n'existe plus." };

    await writeAudit({
      actorId: caller.actorId,
      action: "slot_unassigned",
      entity: "time_slots",
      entityId: assignment.slot_id,
      details: { profile_id: assignment.profile_id },
    });
    refresh();
    return { ok: true, message: "Formateur retiré du créneau." };
  } catch (error) {
    console.error("unassignFormateur :", error);
    return ERREUR_GENERIQUE;
  }
}
