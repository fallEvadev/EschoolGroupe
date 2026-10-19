import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { loadSheetData, type SheetData } from "@/lib/attendance-data";
import {
  dakarIsoDate,
  isIsoDate,
  isIsoMonth,
  monthDays,
  monthOf,
} from "@/lib/dates";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { requirePedagogyManager } from "../ecoles/access";

import { DayView } from "./day-view";
import { MonthView } from "./month-view";
import { href, STATUS_FILTERS, type View } from "./view";
export const metadata = { title: "Pointages · E-School Groupe" };

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

export default async function PointagesPage({
  searchParams,
}: PageProps<"/admin/pointages">) {
  await requirePedagogyManager();
  const params = await searchParams;
  const now = new Date();
  const today = dakarIsoDate(now);

  const rawDate = one(params.date);
  const rawMonth = one(params.mois);
  const rawStatus = one(params.statut);
  const view: View = {
    vue: one(params.vue) === "mois" ? "mois" : "jour",
    date: isIsoDate(rawDate) ? rawDate : today,
    mois: isIsoMonth(rawMonth) ? rawMonth : monthOf(today),
    ecole: one(params.ecole),
    formateur: one(params.formateur),
    statut:
      STATUS_FILTERS.find((filter) => filter.key === rawStatus)?.key ?? "tous",
  };

  let data: SheetData | { error: string };
  if (!isSupabaseConfigured()) {
    data = {
      error:
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
    };
  } else {
    // Client avec le jeton de l'utilisateur : la RLS réserve la lecture à la
    // Direction pédagogique.
    const supabase = await createServerSupabase();
    data = await loadSheetData(
      supabase,
      view.vue === "jour"
        ? { from: view.date, to: view.date }
        : {
            from: `${view.mois}-01`,
            to: monthDays(view.mois).at(-1) ?? `${view.mois}-28`,
          },
    );
  }

  return (
    <main className="flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Pointages"
        description="Présences, retards et absences des formateurs. Traitez les pointages à vérifier, excusez les absences et marquez les jours sans cours."
        actions={
          <nav
            aria-label="Période"
            className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
          >
            {(["jour", "mois"] as const).map((tab) => (
              <Link
                key={tab}
                href={href(view, { vue: tab })}
                aria-current={view.vue === tab ? "page" : undefined}
                className={cn(
                  "rounded-md px-4 py-2 text-center text-sm font-medium transition-colors",
                  view.vue === tab
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "jour" ? "Jour" : "Mois"}
              </Link>
            ))}
          </nav>
        }
      />

      {"error" in data ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {data.error}
        </p>
      ) : view.vue === "jour" ? (
        <DayView data={data} view={view} now={now} today={today} />
      ) : (
        <MonthView data={data} view={view} now={now} />
      )}
    </main>
  );
}
