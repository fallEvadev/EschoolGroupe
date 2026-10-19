import "server-only";

import type { BilanKind } from "@/lib/bilans";
import { isBilanKind } from "@/lib/bilans";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createServerSupabase } from "@/lib/supabase/server";

export type PublishedBilan = {
  id: string;
  schoolName: string;
  kind: BilanKind;
  periodStart: string;
  publishedAt: string;
};

/**
 * Derniers bilans publiés, pour la page « Documents » de la Direction
 * pédagogique. Lus avec son jeton : la RLS de `bilans` ne les ouvre qu'à elle.
 */
export async function loadPublishedBilans(): Promise<
  { bilans: PublishedBilan[] } | { error: string }
> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bilans")
    .select("id, school_id, period_kind, period_start, published_at")
    .eq("status", "publie")
    .not("pdf_path", "is", null)
    .order("published_at", { ascending: false })
    .limit(8);
  if (error) return { error: describeSupabaseError("bilans", error).message };
  if (data.length === 0) return { bilans: [] };

  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .select("id, name")
    .in("id", [...new Set(data.map((row) => row.school_id))]);
  if (schoolsError) {
    return {
      error: describeSupabaseError("schools", schoolsError).message,
    };
  }
  const names = new Map(schools.map((school) => [school.id, school.name]));

  return {
    bilans: data.flatMap((row) =>
      isBilanKind(row.period_kind) && row.published_at
        ? [
            {
              id: row.id,
              schoolName: names.get(row.school_id) ?? "École",
              kind: row.period_kind,
              periodStart: row.period_start,
              publishedAt: row.published_at,
            },
          ]
        : [],
    ),
  };
}
