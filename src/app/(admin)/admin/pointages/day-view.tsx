import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SELECT_CLASS } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { type SheetData } from "@/lib/attendance-data";
import { buildSheet, countRows } from "@/lib/attendance-sheet";
import { formatIsoLongDate, shiftIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { ClosedDayControl } from "./sheet-actions";

import { SheetRowCard } from "./row-card";
import { href, matchesStatus, STATUS_FILTERS, type View } from "./view";
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

export function DayView({
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
          <Field id="date" label="Date">
            <Input id="date" name="date" type="date" defaultValue={view.date} />
          </Field>
          <Field id="ecole" label="École">
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
          </Field>
          <Field id="formateur" label="Formateur">
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
          </Field>
          <Field id="statut" label="Statut">
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
          </Field>
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
