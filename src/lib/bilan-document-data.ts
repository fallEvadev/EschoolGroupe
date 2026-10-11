import "server-only";

import { isBilanKind } from "@/lib/bilans";
import { dakarIsoDate } from "@/lib/dates";
import {
  bilanFileName,
  type BilanDocData,
  type BilanDocReport,
  type DocImage,
} from "@/lib/exports/bilan-docx";
import { readImageSize } from "@/lib/image-size";
import { ORG_ASSETS_BUCKET } from "@/lib/org-assets";
import { parseIssues } from "@/lib/reports";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Télécharge le logo ou la signature. Une image absente ou illisible ne bloque
 * pas le bilan : le document est simplement généré sans elle.
 */
async function loadImage(
  supabase: ServerSupabase,
  path: string | null,
): Promise<DocImage | null> {
  if (!path) return null;
  const type = path.endsWith(".png")
    ? "png"
    : path.endsWith(".jpg")
      ? "jpg"
      : null;
  if (!type) return null;

  const { data, error } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .download(path);
  if (error || !data) {
    console.error("storage :", error?.message ?? "image introuvable");
    return null;
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const size = readImageSize(bytes, type);
  return size ? { data: bytes, type, size } : null;
}

/**
 * Rassemble tout ce qu'il faut pour écrire le Word d'un bilan. Lu avec le jeton
 * de l'utilisateur : la RLS limite la lecture à la Direction pédagogique.
 * `null` si le bilan n'existe pas ou n'est pas visible.
 */
export async function loadBilanDocument(
  bilanId: string,
): Promise<
  { data: BilanDocData; fileName: string } | null | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  const supabase = await createServerSupabase();

  const bilanResult = await supabase
    .from("bilans")
    .select("id, school_id, period_kind, period_start")
    .eq("id", bilanId)
    .maybeSingle();
  if (bilanResult.error) {
    return {
      error: describeSupabaseError("bilans", bilanResult.error).message,
    };
  }
  const bilan = bilanResult.data;
  if (!bilan) return null;
  if (!isBilanKind(bilan.period_kind)) {
    return { error: "Type de période inconnu pour ce bilan." };
  }
  const kind = bilan.period_kind;

  const [schoolResult, linksResult, settingsResult, directory] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name")
        .eq("id", bilan.school_id)
        .maybeSingle(),
      supabase
        .from("bilan_reports")
        .select("report_id")
        .eq("bilan_id", bilan.id)
        .limit(2000),
      supabase
        .from("organization_settings")
        .select("organization_name, academic_year, logo_path, signature_path")
        .maybeSingle(),
      // Annuaire minimal : la Direction ne lit pas la table des profils.
      supabase.rpc("pedagogy_staff_directory"),
    ]);
  for (const [table, result] of [
    ["schools", schoolResult],
    ["bilan_reports", linksResult],
    ["organization_settings", settingsResult],
    ["pedagogy_staff_directory", directory],
  ] as const) {
    if (result.error) {
      return { error: describeSupabaseError(table, result.error).message };
    }
  }

  const reportIds = (linksResult.data ?? []).map((l) => l.report_id);
  const reportsResult = reportIds.length
    ? await supabase
        .from("daily_reports")
        .select(
          "id, report_date, profile_id, slot_id, classes, course_theme, equipment_ok, equipment_issues",
        )
        .in("id", reportIds)
        .limit(2000)
    : { data: [], error: null };
  if (reportsResult.error) {
    return {
      error: describeSupabaseError("daily_reports", reportsResult.error)
        .message,
    };
  }

  const slotIds = [...new Set(reportsResult.data.map((r) => r.slot_id))];
  const slotsResult = slotIds.length
    ? await supabase
        .from("time_slots")
        .select("id, starts_at, ends_at")
        .in("id", slotIds)
    : { data: [], error: null };
  if (slotsResult.error) {
    return {
      error: describeSupabaseError("time_slots", slotsResult.error).message,
    };
  }

  const names = new Map((directory.data ?? []).map((p) => [p.id, p.full_name]));
  const slots = new Map(slotsResult.data.map((s) => [s.id, s]));

  const reports: BilanDocReport[] = reportsResult.data.map((r) => {
    const slot = slots.get(r.slot_id);
    return {
      date: r.report_date,
      startsAt: slot?.starts_at ?? null,
      endsAt: slot?.ends_at ?? null,
      formateur: names.get(r.profile_id) ?? "Formateur",
      classes: r.classes,
      courseTheme: r.course_theme,
      equipmentOk: r.equipment_ok,
      issues: parseIssues(r.equipment_issues).map((issue) => ({
        equipment: issue.equipment,
        description: issue.description,
      })),
    };
  });

  const settings = settingsResult.data;
  const [logo, signature] = await Promise.all([
    loadImage(supabase, settings?.logo_path ?? null),
    loadImage(supabase, settings?.signature_path ?? null),
  ]);
  const schoolName = schoolResult.data?.name ?? "École";

  return {
    fileName: bilanFileName(schoolName, kind, bilan.period_start),
    data: {
      organizationName: settings?.organization_name ?? "E-School Groupe",
      academicYear: settings?.academic_year ?? "",
      schoolName,
      kind,
      periodStart: bilan.period_start,
      reports,
      logo,
      signature,
      generatedOn: dakarIsoDate(),
    },
  };
}
