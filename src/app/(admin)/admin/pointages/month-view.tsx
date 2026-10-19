import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/components/ui/select";
import { type SheetData } from "@/lib/attendance-data";
import { monthSummary } from "@/lib/attendance-sheet";
import { formatMonthLabel, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { href, type View } from "./view";
export function MonthView({
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
