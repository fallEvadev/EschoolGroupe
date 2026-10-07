import { PageHeader } from "@/components/layout/page-header";
import { OpenProgramButton } from "@/components/open-program-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  dakarIsoDate,
  formatDate,
  formatMonthLabel,
  monthOf,
} from "@/lib/dates";
import { loadPrograms } from "@/lib/programs-data";
import { formatFileSize } from "@/lib/staff-documents";

import { requirePedagogyManager } from "../ecoles/access";
import { PublishProgramForm } from "./publish-program-form";

export const metadata = { title: "Programme mensuel · E-School Groupe" };

export default async function ProgrammesPage() {
  await requirePedagogyManager();
  const loaded = await loadPrograms();

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Programme mensuel"
        description="Publiez chaque mois le programme en PDF : les formateurs le consultent depuis leur espace. Un programme remplacé est conservé."
      />

      <PublishProgramForm defaultMonth={monthOf(dakarIsoDate())} />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.programs.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground">
            Aucun programme publié pour le moment.
          </p>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Programmes publiés</h2>
          <ul className="flex flex-col gap-3">
            {loaded.programs.map((program) => (
              <li key={program.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-semibold first-letter:uppercase">
                      {formatMonthLabel(program.month)}
                      <Badge
                        variant={
                          program.status === "actif" ? "success" : "neutral"
                        }
                        className="ml-2 align-middle"
                      >
                        {program.status === "actif" ? "En vigueur" : "Remplacé"}
                      </Badge>
                    </p>
                    <p className="truncate text-sm">{program.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {program.fileName} · {formatFileSize(program.sizeBytes)} ·
                      publié le {formatDate(program.publishedAt)}
                    </p>
                  </div>
                  <OpenProgramButton
                    programId={program.id}
                    variant="outline"
                    size="sm"
                  />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
