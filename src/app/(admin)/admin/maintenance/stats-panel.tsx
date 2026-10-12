import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  formatDuration,
  RECENT_DAYS,
  type TicketStats,
} from "@/lib/ticket-stats";

/**
 * Chiffres de suivi de la maintenance : quatre tuiles et un tableau par école.
 * Le tableau est la vue détaillée et accessible des mêmes chiffres.
 */
export function StatsPanel({
  stats,
  schools,
}: {
  stats: TicketStats;
  schools: { id: string; name: string }[];
}) {
  const names = new Map(schools.map((s) => [s.id, s.name]));
  const average = stats.averageResolutionMs;

  return (
    <section
      aria-label="Statistiques de la maintenance"
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={String(stats.toTreat)}
          label="À traiter"
          hint="Ouverts, pas encore pris en charge"
        />
        <StatTile value={String(stats.inProgress)} label="En cours" />
        <StatTile
          value={String(stats.resolvedRecently)}
          label="Résolus"
          hint={`Sur les ${RECENT_DAYS} derniers jours`}
        />
        <StatTile
          value={average === null ? "—" : formatDuration(average)}
          label="Délai moyen"
          hint={
            average === null
              ? "Aucune résolution récente"
              : "De l'ouverture à la résolution"
          }
        />
      </div>

      {stats.bySchool.length > 0 && (
        <Card className="overflow-x-auto p-4">
          <h2 className="text-primary mb-2 text-xs font-semibold tracking-[0.12em] uppercase">
            Pannes par école
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th scope="col" className="py-1 pr-4 font-medium">
                  École
                </th>
                <th scope="col" className="py-1 pr-4 text-right font-medium">
                  À traiter ou en cours
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.bySchool.map((row) => (
                <tr key={row.schoolId} className="border-t">
                  <th scope="row" className="py-1.5 pr-4 text-left font-medium">
                    {names.get(row.schoolId) ?? "École"}
                  </th>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {row.open}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
