"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  machineSchema,
  machineStatusSchema,
  machineUpdateSchema,
  type MachineResult,
} from "@/lib/validations/machines";

import { MAINTENANCE_MANAGER_ROLES } from "./access";

/** Code PostgreSQL d'une valeur en double. */
const UNIQUE_VIOLATION = "23505";

const ERREUR_GENERIQUE: MachineResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

const DOUBLON: MachineResult = {
  ok: false,
  message: "Une machine active porte déjà ce nom dans cette école.",
};

const REFUSE: MachineResult = {
  ok: false,
  message: "Vous ne pouvez pas modifier cette machine.",
};

function invalid(error: { issues: { message: string }[] }): MachineResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Données invalides.",
  };
}

function refresh() {
  revalidatePath("/admin/parc");
}

/** Ajoute une machine à l'inventaire d'une école. */
export async function addMachine(input: unknown): Promise<MachineResult> {
  const caller = await requireActionRole(MAINTENANCE_MANAGER_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = machineSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  try {
    // Jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const { data: created, error } = await supabase
      .from("machines")
      .insert({
        school_id: data.schoolId,
        label: data.label,
        kind: data.kind,
        serial_number: data.serialNumber,
        created_by: caller.actorId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return DOUBLON;
      console.error("machines :", error.message);
      return ERREUR_GENERIQUE;
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "machine_created",
      entity: "machines",
      entityId: created.id,
      details: { label: data.label, kind: data.kind },
    });
    refresh();
    return { ok: true, id: created.id, message: "Machine ajoutée." };
  } catch (error) {
    console.error("addMachine :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Modifie le nom, le type ou le numéro de série (jamais l'école). */
export async function updateMachine(input: unknown): Promise<MachineResult> {
  const caller = await requireActionRole(MAINTENANCE_MANAGER_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = machineUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("machines")
      .update({
        label: data.label,
        kind: data.kind,
        serial_number: data.serialNumber,
      })
      .eq("id", data.machineId)
      .select("id");
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return DOUBLON;
      console.error("machines :", error.message);
      return ERREUR_GENERIQUE;
    }
    // Refus de la RLS : aucune erreur, mais aucune ligne modifiée.
    if (updated.length === 0) return REFUSE;

    await writeAudit({
      actorId: caller.actorId,
      action: "machine_updated",
      entity: "machines",
      entityId: data.machineId,
      details: { label: data.label, kind: data.kind },
    });
    refresh();
    return { ok: true, id: data.machineId, message: "Machine mise à jour." };
  } catch (error) {
    console.error("updateMachine :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Archive ou restaure une machine. Aucune suppression physique. */
export async function setMachineStatus(input: unknown): Promise<MachineResult> {
  const caller = await requireActionRole(MAINTENANCE_MANAGER_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = machineStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { machineId, status } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("machines")
      .update({ status })
      .eq("id", machineId)
      .select("label");
    if (error) {
      // Restaurer une machine dont le nom est repris par une autre machine active.
      if (error.code === UNIQUE_VIOLATION) {
        return {
          ok: false,
          message:
            "Une autre machine active porte ce nom : renommez-la avant de restaurer celle-ci.",
        };
      }
      console.error("machines :", error.message);
      return ERREUR_GENERIQUE;
    }
    const machine = updated[0];
    if (!machine) return REFUSE;

    await writeAudit({
      actorId: caller.actorId,
      action: status === "archive" ? "machine_archived" : "machine_restored",
      entity: "machines",
      entityId: machineId,
      details: { label: machine.label },
    });
    refresh();
    return {
      ok: true,
      id: machineId,
      message:
        status === "archive" ? "Machine archivée." : "Machine restaurée.",
    };
  } catch (error) {
    console.error("setMachineStatus :", error);
    return ERREUR_GENERIQUE;
  }
}
