import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { loadSheetData } from "@/lib/attendance-data";
import { buildSheet, type SheetRow } from "@/lib/attendance-sheet";
import { dakarIsoDate, formatIsoLongDate } from "@/lib/dates";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

import { SheetRowCard } from "../pointages/row-card";

export const metadata = { title: "Aujourd'hui · E-School" };

/** Un formateur a pointé son arrivée mais sa descente n'est pas validée. */
function awaitingDeparture(row: SheetRow): boolean {
  const attendance = row.attendance;
  return !!attendance && attendance.requiresDeparture && !attendance.departedAt;
}

/**
 * Page d'urgence du Super-Admin : tous les créneaux du jour, avec l'état de
 * chaque formateur. Quand un formateur doit partir avant l'heure prévue
 * (maladie, urgence, cours non tenu), le Super-Admin débloque sa descente avec
 * l'heure réelle de départ et un motif ; son rapport s'ouvre aussitôt. Les
 * horaires des créneaux de la semaine ne sont pas touchés.
 */
export default async function TodayPage() {
  const role = await requireSpace("admin");
  if (role !== "super_admin") redirect("/non-autorise");

  const now = new Date();
  const today = dakarIsoDate(now);

  const data = isSupabaseConfigured()
    ? await loadSheetData(await createServerSupabase(), {
        from: today,
        to: today,
      })
    : {
        error:
          "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
      };

  if ("error" in data) {
    return (
      <main className="flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <PageHeader eyebrow="Urgences" title="Aujourd'hui" />
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {data.error}
        </p>
      </main>
    );
  }

  const rows = buildSheet({
    date: today,
    now,
    slots: data.slots,
    assignments: data.assignments,
    attendances: data.attendances,
    reviews: data.reviews,
    excuses: data.excuses,
    closedDays: data.closedDays,
  }).sort(
    (a, b) =>
      Number(awaitingDeparture(b)) - Number(awaitingDeparture(a)) ||
      a.startsAt.localeCompare(b.startsAt) ||
      a.key.localeCompare(b.key),
  );

  const schoolNames = new Map(data.schools.map((s) => [s.id, s.name]));
  const toUnlock = rows.filter(awaitingDeparture);
  const notYet = rows.filter((row) => !row.attendance);
  const done = rows.filter(
    (row) => row.attendance && !awaitingDeparture(row),
  );

  const stats = [
    { label: "Créneaux attendus", value: rows.length },
    { label: "Descente à débloquer", value: toUnlock.length },
    { label: "Pas encore pointés", value: notYet.length },
    { label: "Terminés", value: done.length },
  ];

  return (
    <main className="flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Urgences"
        title="Aujourd'hui"
        description={
          <>
            <span className="first-letter:uppercase">
              {formatIsoLongDate(today)}
            </span>
            . Si un formateur doit partir avant l&apos;heure prévue (maladie,
            urgence, élèves absents), cliquez sur{" "}
            <strong>« Valider la descente »</strong> sur sa ligne : indiquez
            l&apos;heure réelle de départ et le motif. Son rapport s&apos;ouvre
            aussitôt.
          </>
        }
      />

      <section aria-label="Chiffres du jour">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <li key={stat.label}>
              <Card className="flex h-full flex-col gap-1 p-4">
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p className="font-heading text-3xl font-extrabold tabular-nums">
                  {stat.value}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {rows.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground">
            Aucun créneau attendu aujourd&apos;hui.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.key}>
              <SheetRowCard
                row={row}
                name={data.names.get(row.profileId) ?? "Compte inconnu"}
                school={schoolNames.get(row.schoolId) ?? "École"}
                today={today}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
