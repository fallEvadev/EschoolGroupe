import "server-only";

import { programMonthFromDate, type ProgramItem } from "@/lib/programs";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

/**
 * Programmes mensuels visibles par l'utilisateur connecté. Lus avec SON jeton :
 * la RLS montre toutes les versions à la Direction pédagogique, et seulement
 * celles en vigueur aux formateurs.
 */
export async function loadPrograms(): Promise<
  { programs: ProgramItem[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("monthly_programs")
    .select(
      "id, program_month, title, file_name, size_bytes, published_at, status",
    )
    .order("program_month", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) {
    return {
      error: describeSupabaseError("monthly_programs", error).message,
    };
  }

  return {
    programs: data.flatMap((row) =>
      row.status === "actif" || row.status === "remplace"
        ? [
            {
              id: row.id,
              month: programMonthFromDate(row.program_month),
              title: row.title,
              fileName: row.file_name,
              sizeBytes: row.size_bytes,
              publishedAt: row.published_at,
              status: row.status,
            },
          ]
        : [],
    ),
  };
}
