import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locationSummary } from "@/lib/attendance";
import { loadSheetData, type SheetData } from "@/lib/attendance-data";
import {
  buildSheet,
  canExcuse,
  countRows,
  monthSummary,
  ROW_STATE_BADGE,
  ROW_STATE_LABELS,
  type RowState,
  type SheetRow,
} from "@/lib/attendance-sheet";
import {
  dakarIsoDate,
  formatClock,
  formatIsoLongDate,
  formatMonthLabel,
  isIsoDate,
  isIsoMonth,
  monthDays,
  monthOf,
  shiftIsoDate,
  shiftMonth,
} from "@/lib/dates";
import { formatTime, mapsUrl } from "@/lib/schools";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { requirePedagogyManager } from "../ecoles/access";
import {
  CancelExcuseButton,
  ClosedDayControl,
  ExcuseAction,
  ReviewActions,
} from "./sheet-actions";

export const metadata = { title: "Pointages · E-School Groupe" };

const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none md:text-sm";

/** Filtres de statut de la vue du jour. */
const STATUS_FILTERS = [
  { key: "tous", label: "Tous les statuts" },
  { key: "a_verifier", label: "À vérifier" },
  { key: "present", label: "Présents" },
  { key: "retard", label: "Retards" },
  { key: "absent", label: "Absents" },
  { key: "excuse", label: "Excusés" },
  { key: "en_attente", label: "Pas encore pointés" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

function matchesStatus(state: RowState, filter: StatusFilter): boolean {
  if (filter === "tous") return true;
  // Un pointage refusé compte comme une absence.
  if (filter === "absent") return state === "absent" || state === "refuse";
  return state === filter;
}

type View = {
  vue: "jour" | "mois";
  date: string;
  mois: string;
  ecole: string;
  formateur: string;
  statut: StatusFilter;
};

/** Adresse de la page : seuls les réglages différents des valeurs par défaut y figurent. */
function href(view: View, change: Partial<View> = {}): string {
  const next = { ...view, ...change };
  const search = new URLSearchParams();
  if (next.vue === "mois") search.set("vue", "mois");
  if (next.vue === "jour" && next.date !== dakarIsoDate()) {
    search.set("date", next.date);
  }
  if (next.vue === "mois" && next.mois !== monthOf(dakarIsoDate())) {
    search.set("mois", next.mois);
  }
  if (next.ecole) search.set("ecole", next.ecole);
  if (next.vue === "jour" && next.formateur) {
    search.set("formateur", next.formateur);
  }
  if (next.vue === "jour" && next.statut !== "tous") {
    search.set("statut", next.statut);
  }
  const query = search.toString();
  return query ? `/admin/pointages?${query}` : "/admin/pointages";
}

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
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
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

/** Formateurs ayant un créneau ou un pointage dans les données chargées. */
function formateurOptions(data: SheetData): { id: string; name: string }[] {
  const ids = new Set([
    ...data.assignments.map((a) => a.profileId),
    ...data.attendances.map((a) => a.profileId),
  ]);
  return [...ids]
    .map((id) => ({ id, name: data.names.get(id) ?? "Compte inconnu" }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function DayView({
  data,
  view,
  now,
  today,
}: {
  data: SheetData;
  view: View;
  now: Date;
  today: string;
}) {
  const rows = buildSheet({
    date: view.date,
    now,
    slots: data.slots,
    assignments: data.assignments,
    attendances: data.attendances,
    reviews: data.reviews,
    excuses: data.excuses,
    closedDays: data.closedDays,
  });
  const schoolNames = new Map(data.schools.map((s) => [s.id, s.name]));
  const scoped = rows.filter(
    (row) =>
      (!view.ecole || row.schoolId === view.ecole) &&
      (!view.formateur || row.profileId === view.formateur),
  );
  const counts = countRows(scoped);
  const visible = scoped.filter((row) => matchesStatus(row.state, view.statut));

  const activeSchools = data.schools
    .filter((school) => school.status === "actif")
    .map((school) => ({ id: school.id, name: school.name }));

  const stats = [
    { label: "Présents", value: counts.present },
    { label: "Retards", value: counts.retard },
    {
      label: "À vérifier",
      value: counts.aVerifier,
      alert: counts.aVerifier > 0,
    },
    { label: "Absents", value: counts.absent },
    { label: "Excusés", value: counts.excuse },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link
            href={href(view, { date: shiftIsoDate(view.date, -1) })}
            aria-label="Jour précédent"
          >
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-48 text-center text-lg font-semibold first-letter:uppercase">
          {formatIsoLongDate(view.date)}
          {view.date === today && (
            <Badge className="ml-2 align-middle">Aujourd&apos;hui</Badge>
          )}
        </h2>
        <Button variant="outline" size="icon" asChild>
          <Link
            href={href(view, { date: shiftIsoDate(view.date, 1) })}
            aria-label="Jour suivant"
          >
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        {view.date !== today && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={href(view, { date: today })}>Aujourd&apos;hui</Link>
          </Button>
        )}
      </div>

      <Card className="p-4">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          role="search"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={view.date} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ecole">École</Label>
            <select
              id="ecole"
              name="ecole"
              defaultValue={view.ecole}
              className={SELECT_CLASS}
            >
              <option value="">Toutes les écoles</option>
              {data.schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="formateur">Formateur</Label>
            <select
              id="formateur"
              name="formateur"
              defaultValue={view.formateur}
              className={SELECT_CLASS}
            >
              <option value="">Tous les formateurs</option>
              {formateurOptions(data).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="statut">Statut</Label>
            <select
              id="statut"
              name="statut"
              defaultValue={view.statut}
              className={SELECT_CLASS}
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.key} value={filter.key}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">Filtrer</Button>
            <Button variant="ghost" asChild>
              <Link href="/admin/pointages">Réinitialiser</Link>
            </Button>
          </div>
        </form>
      </Card>

      <section aria-label="Chiffres du jour">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <li key={stat.label}>
              <Card
                className={cn(
                  "flex h-full flex-col gap-1 p-4",
                  stat.alert && "border-warning",
                )}
              >
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p className="font-heading text-3xl font-extrabold tabular-nums">
                  {stat.value}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        {counts.enAttente > 0 && (
          <p className="text-muted-foreground mt-2 text-sm">
            {counts.enAttente} formateur(s) n&apos;ont pas encore pointé : leur
            créneau n&apos;est pas terminé.
          </p>
        )}
      </section>

      <ClosedDayControl
        date={view.date}
        schools={activeSchools}
        closedDays={data.closedDays.map((closed) => ({
          id: closed.id,
          schoolName: closed.schoolId
            ? (schoolNames.get(closed.schoolId) ?? "École")
            : null,
          reason: closed.reason,
        }))}
      />

      {visible.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground">
            {rows.length === 0
              ? "Aucun créneau attendu ni pointage ce jour-là."
              : "Aucune ligne ne correspond à ces filtres."}
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row) => (
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
    </>
  );
}

function SheetRowCard({
  row,
  name,
  school,
  today,
}: {
  row: SheetRow;
  name: string;
  school: string;
  today: string;
}) {
  const { attendance, review, excuse } = row;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          <p className="text-muted-foreground text-sm">
            {school} · {formatTime(row.startsAt)}–{formatTime(row.endsAt)}
            {row.label ? ` (${row.label})` : ""}
          </p>
        </div>
        <Badge variant={ROW_STATE_BADGE[row.state]}>
          {ROW_STATE_LABELS[row.state]}
        </Badge>
      </div>

      {attendance && (
        <p className="text-sm">
          Pointé à {formatClock(attendance.recordedAt)}
          {attendance.lateMinutes > 0
            ? ` · ${attendance.lateMinutes} min après le début`
            : ""}
          <span className="text-muted-foreground">
            {" "}
            · {locationSummary(attendance)}
          </span>
          {attendance.latitude !== null && attendance.longitude !== null && (
            <>
              {" "}
              <a
                href={mapsUrl(attendance.latitude, attendance.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Voir sur la carte
              </a>
            </>
          )}
        </p>
      )}
      {review && (
        <p className="text-sm">
          <span className="font-medium">
            {review.decision === "valide"
              ? "Validé par la Direction"
              : "Refusé par la Direction"}
          </span>
          {review.comment ? ` : ${review.comment}` : ""}
        </p>
      )}
      {excuse && (
        <p className="text-sm">
          <span className="font-medium">Absence excusée</span> : {excuse.reason}
        </p>
      )}

      {(attendance?.status === "a_verifier" ||
        (canExcuse(row.state) && row.date <= today) ||
        excuse) && (
        <div className="flex flex-wrap items-center gap-2">
          {attendance?.status === "a_verifier" && (
            <ReviewActions
              attendanceId={attendance.id}
              formateurName={name}
              decided={review !== null}
            />
          )}
          {canExcuse(row.state) && row.date <= today && (
            <ExcuseAction
              profileId={row.profileId}
              slotId={row.slotId}
              date={row.date}
              formateurName={name}
            />
          )}
          {excuse && <CancelExcuseButton excuseId={excuse.id} />}
        </div>
      )}
    </Card>
  );
}

function MonthView({
  data,
  view,
  now,
}: {
  data: SheetData;
  view: View;
  now: Date;
}) {
  const inScope = <T extends { schoolId: string }>(item: T) =>
    !view.ecole || item.schoolId === view.ecole;

  const summary = monthSummary({
    month: view.mois,
    now,
    slots: data.slots.filter(inScope),
    assignments: data.assignments,
    attendances: data.attendances.filter(inScope),
    reviews: data.reviews,
    excuses: data.excuses,
    closedDays: data.closedDays,
  });
  const lines = [...summary.entries()]
    .map(([profileId, counts]) => ({
      profileId,
      name: data.names.get(profileId) ?? "Compte inconnu",
      counts,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link
            href={href(view, { mois: shiftMonth(view.mois, -1) })}
            aria-label="Mois précédent"
          >
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-48 text-center text-lg font-semibold first-letter:uppercase">
          {formatMonthLabel(view.mois)}
        </h2>
        <Button variant="outline" size="icon" asChild>
          <Link
            href={href(view, { mois: shiftMonth(view.mois, 1) })}
            aria-label="Mois suivant"
          >
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-4" role="search">
          <input type="hidden" name="vue" value="mois" />
          <input type="hidden" name="mois" value={view.mois} />
          <div className="flex min-w-56 flex-col gap-2">
            <Label htmlFor="ecole-mois">École</Label>
            <select
              id="ecole-mois"
              name="ecole"
              defaultValue={view.ecole}
              className={SELECT_CLASS}
            >
              <option value="">Toutes les écoles</option>
              {data.schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Filtrer</Button>
        </form>
      </Card>

      {lines.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground">
            Aucun créneau attendu ni pointage pour ce mois.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Synthèse de {formatMonthLabel(view.mois)} par formateur
            </caption>
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th scope="col" className="p-3 font-medium">
                  Formateur
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  Présent
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  Retard
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  À vérifier
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  Absent
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  Excusé
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {lines.map((line) => (
                <tr key={line.profileId}>
                  <th scope="row" className="p-3 text-left font-medium">
                    {line.name}
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {line.counts.present}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {line.counts.retard}
                  </td>
                  <td
                    className={cn(
                      "p-3 text-right tabular-nums",
                      line.counts.aVerifier > 0 && "text-warning font-semibold",
                    )}
                  >
                    {line.counts.aVerifier}
                  </td>
                  <td
                    className={cn(
                      "p-3 text-right tabular-nums",
                      line.counts.absent > 0 &&
                        "text-destructive font-semibold",
                    )}
                  >
                    {line.counts.absent}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {line.counts.excuse}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-muted-foreground text-sm">
        Un pointage refusé compte comme une absence. Les jours sans cours et les
        jours à venir ne comptent pas.
      </p>
    </>
  );
}
