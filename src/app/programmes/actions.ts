"use server";

import { requireActionRole } from "@/lib/auth/action-guard";
import { PROGRAMS_BUCKET } from "@/lib/programs";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  programIdSchema,
  type ProgramUrlResult,
} from "@/lib/validations/programs";

/** Durée de validité d'un lien de consultation (courte : il sert à ouvrir le PDF). */
const SIGNED_URL_SECONDS = 60;

/**
 * Lien de consultation d'un programme, valable 60 secondes. Réservé aux
 * formateurs (programme en vigueur seulement, par la RLS) et à la Direction
 * pédagogique (toutes les versions).
 */
export async function getProgramUrl(input: unknown): Promise<ProgramUrlResult> {
  const caller = await requireActionRole([
    "formateur",
    "admin_pedagogie",
    "super_admin",
  ]);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = programIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Programme invalide." };

  try {
    // Client avec le jeton de l'utilisateur : la RLS de la table et du stockage
    // décide de ce qu'il a le droit de voir.
    const supabase = await createServerSupabase();
    const { data: program } = await supabase
      .from("monthly_programs")
      .select("storage_path")
      .eq("id", parsed.data.programId)
      .maybeSingle();
    if (!program) return { ok: false, message: "Programme introuvable." };

    const { data, error } = await supabase.storage
      .from(PROGRAMS_BUCKET)
      .createSignedUrl(program.storage_path, SIGNED_URL_SECONDS);
    if (error) {
      console.error("storage :", error.message);
      return {
        ok: false,
        message: "Une erreur est survenue. Réessayez dans un instant.",
      };
    }
    return { ok: true, url: data.signedUrl };
  } catch (error) {
    console.error("getProgramUrl :", error);
    return {
      ok: false,
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
}
