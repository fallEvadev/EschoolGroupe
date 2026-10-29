"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { generateCode } from "@/lib/daily-codes";
import { dakarIsoDate } from "@/lib/dates";
import { createServerSupabase } from "@/lib/supabase/server";
import { schoolIdSchema, type SchoolResult } from "@/lib/validations/schools";

import { loadStaffDirectory, PEDAGOGY_ROLES } from "../ecoles/access";

/** Code PostgreSQL d'une valeur en double. */
const UNIQUE_VIOLATION = "23505";

/** Nombre d'essais si le code tiré est déjà pris par une autre école. */
const MAX_ATTEMPTS = 8;

const ERREUR_GENERIQUE: SchoolResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Tirage imprévisible (et non `Math.random`) pour un code secret. */
const randomBelow = (max: number) => randomInt(max);

/**
 * Crée le code du jour d'une école. Si le code tiré est déjà celui d'une autre
 * école ce jour-là, on en tire un autre. Si l'école a déjà un code actif
 * (quelqu'un l'a créé entre-temps), on le laisse en place.
 */
async function insertCode(
  supabase: Supabase,
  schoolId: string,
  today: string,
  actorId: string,
): Promise<"created" | "exists" | "failed"> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { error } = await supabase.from("daily_codes").insert({
      school_id: schoolId,
      code_date: today,
      code: generateCode(randomBelow),
      generated_by: actorId,
    });
    if (!error) return "created";
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("daily_codes :", error.message);
      return "failed";
    }
    // Conflit sur « une école, un jour » : le code existe déjà.
    if (error.message.includes("school_day")) return "exists";
    // Sinon : code déjà pris par une autre école, on réessaie.
  }
  return "failed";
}

/**
 * Directeurs prévenus (par la base, à la création du code) pour les écoles qui
 * viennent d'avoir leur code, et écoles sans directeur actif. Un échec de
 * lecture donne `null` : le message de confirmation omet alors ce détail.
 */
async function directorsReached(
  supabase: Supabase,
  schoolIds: string[],
): Promise<{ directors: number; schoolsWithout: number } | null> {
  if (schoolIds.length === 0) return { directors: 0, schoolsWithout: 0 };
  const [links, directory] = await Promise.all([
    supabase
      .from("school_directors")
      .select("school_id, profile_id")
      .eq("status", "actif")
      .in("school_id", schoolIds),
    loadStaffDirectory(supabase),
  ]);
  if (links.error || "error" in directory) return null;

  const active = new Set(
    directory.staff
      .filter(
        (person) =>
          person.role === "directeur_partenaire" && person.status === "actif",
      )
      .map((person) => person.id),
  );
  const reached = links.data.filter((link) => active.has(link.profile_id));
  const covered = new Set(reached.map((link) => link.school_id));
  return {
    directors: new Set(reached.map((link) => link.profile_id)).size,
    schoolsWithout: schoolIds.filter((id) => !covered.has(id)).length,
  };
}

/** Génère le code du jour de chaque école active qui n'en a pas encore. */
export async function generateTodayCodes(): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  try {
    // Client avec le jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const today = dakarIsoDate();

    const { data: schools, error: schoolsError } = await supabase
      .from("schools")
      .select("id")
      .eq("status", "actif");
    if (schoolsError) {
      console.error("schools :", schoolsError.message);
      return ERREUR_GENERIQUE;
    }
    if (schools.length === 0) {
      return {
        ok: false,
        message: "Aucune école active : ajoutez d'abord une école.",
      };
    }

    const { data: existing, error: existingError } = await supabase
      .from("daily_codes")
      .select("school_id")
      .eq("code_date", today)
      .eq("status", "actif");
    if (existingError) {
      console.error("daily_codes :", existingError.message);
      return ERREUR_GENERIQUE;
    }
    const done = new Set(existing.map((row) => row.school_id));
    const missing = schools.filter((school) => !done.has(school.id));
    if (missing.length === 0) {
      return { ok: true, message: "Tous les codes du jour existent déjà." };
    }

    let created = 0;
    let failed = 0;
    const createdSchoolIds: string[] = [];
    for (const school of missing) {
      const outcome = await insertCode(
        supabase,
        school.id,
        today,
        caller.actorId,
      );
      if (outcome === "created") {
        created++;
        createdSchoolIds.push(school.id);
      }
      if (outcome === "failed") failed++;
    }

    // Jamais la valeur des codes dans l'audit : seulement le fait et le nombre.
    if (created > 0) {
      await writeAudit({
        actorId: caller.actorId,
        action: "codes_generated",
        entity: "daily_codes",
        entityId: null,
        details: { date: today, created },
      });
    }
    revalidatePath("/admin/codes");

    if (failed > 0) {
      return {
        ok: false,
        message: `${created} code(s) généré(s), mais ${failed} école(s) n'ont pas pu être traitées. Relancez la génération.`,
      };
    }
    const codesLabel =
      created === 1 ? "1 code généré" : `${created} codes générés`;
    // Les directeurs sont prévenus par la base, à la création de chaque code.
    const reached = await directorsReached(supabase, createdSchoolIds);
    if (!reached) return { ok: true, message: `${codesLabel}.` };

    const directorsLabel =
      reached.directors === 0
        ? "aucun directeur à prévenir"
        : reached.directors === 1
          ? "1 directeur prévenu"
          : `${reached.directors} directeurs prévenus`;
    const withoutLabel =
      reached.schoolsWithout === 0
        ? ""
        : reached.schoolsWithout === 1
          ? " 1 école n'a aucun directeur rattaché."
          : ` ${reached.schoolsWithout} écoles n'ont aucun directeur rattaché.`;
    return {
      ok: true,
      message: `${codesLabel}, ${directorsLabel}.${withoutLabel}`,
    };
  } catch (error) {
    console.error("generateTodayCodes :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Remplace le code du jour d'une école (ex. s'il a été divulgué). L'ancien code
 * est conservé en archive et ne vaut plus ; le changement est atomique côté
 * base (`replace_daily_code`).
 */
export async function regenerateCode(input: unknown): Promise<SchoolResult> {
  const caller = await requireActionRole(PEDAGOGY_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = schoolIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "École invalide.",
    };
  }
  const { schoolId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const today = dakarIsoDate();

    const { data: school } = await supabase
      .from("schools")
      .select("name, status")
      .eq("id", schoolId)
      .maybeSingle();
    if (!school) return { ok: false, message: "École introuvable." };
    if (school.status !== "actif") {
      return {
        ok: false,
        message:
          "Cette école est archivée : aucun code n'est généré pour elle.",
      };
    }

    let replaced = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !replaced; attempt++) {
      const { error } = await supabase.rpc("replace_daily_code", {
        p_school_id: schoolId,
        p_code_date: today,
        p_code: generateCode(randomBelow),
      });
      if (!error) {
        replaced = true;
      } else if (error.code !== UNIQUE_VIOLATION) {
        console.error("replace_daily_code :", error.message);
        return ERREUR_GENERIQUE;
      }
      // Violation d'unicité : code déjà pris par une autre école. La
      // transaction est annulée (l'ancien code reste actif) : on réessaie.
    }
    if (!replaced) return ERREUR_GENERIQUE;

    await writeAudit({
      actorId: caller.actorId,
      action: "code_regenerated",
      entity: "daily_codes",
      entityId: schoolId,
      details: { school: school.name, date: today },
    });
    revalidatePath("/admin/codes");
    return {
      ok: true,
      message: `Nouveau code généré pour ${school.name}. L'ancien ne fonctionne plus.`,
    };
  } catch (error) {
    console.error("regenerateCode :", error);
    return ERREUR_GENERIQUE;
  }
}
