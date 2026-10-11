"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { summarizeGeneration } from "@/lib/bilans";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  generateBilansSchema,
  type BilanResult,
} from "@/lib/validations/bilans";

import { PEDAGOGY_ROLES } from "../ecoles/access";

/** Codes PostgreSQL renvoyés par `generate_bilans`. */
const NOT_ALLOWED = "42501";
const CHECK_VIOLATION = "23514";

const ERREUR_GENERIQUE: BilanResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

/**
 * Le bouton « Générer » : crée ou actualise un bilan pour chaque école qui a des
 * rapports validés sur la période. Tout se passe dans la fonction SQL
 * `generate_bilans` (une seule transaction, avec le jeton de l'utilisateur : la
 * RLS et les garde-fous de la base s'appliquent). Un bilan déjà publié n'est
 * jamais touché.
 */
export async function generateBilans(input: unknown): Promise<BilanResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = generateBilansSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Période invalide.",
    };
  }
  const { kind, periodStart } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("generate_bilans", {
      p_kind: kind,
      p_start: periodStart,
    });
    if (error) {
      // Messages écrits en français dans la base, sans donnée sensible.
      if (error.code === NOT_ALLOWED || error.code === CHECK_VIOLATION) {
        return { ok: false, message: error.message };
      }
      console.error("generate_bilans :", error.message);
      return ERREUR_GENERIQUE;
    }

    const outcomes = data.map((row) => ({ outcome: row.out_outcome }));
    await writeAudit({
      actorId: caller.actorId,
      action: "bilans_generated",
      entity: "bilans",
      entityId: null,
      details: {
        kind,
        period_start: periodStart,
        bilans: outcomes.length,
      },
    });
    revalidatePath("/admin/bilans");
    return { ok: true, message: summarizeGeneration(outcomes) };
  } catch (error) {
    console.error("generateBilans :", error);
    return ERREUR_GENERIQUE;
  }
}
