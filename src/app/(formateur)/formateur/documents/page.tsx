import { ScrollText } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { OpenProgramButton } from "@/components/open-program-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import {
  dakarIsoDate,
  formatDate,
  formatMonthLabel,
  monthOf,
} from "@/lib/dates";
import { splitPrograms, type ProgramItem } from "@/lib/programs";
import { loadPrograms } from "@/lib/programs-data";

export const metadata = { title: "Documents · E-School Groupe" };

/** Une ligne de la liste des programmes (mois, titre, bouton d'ouverture). */
function ProgramRow({ program }: { program: ProgramItem }) {
  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-semibold first-letter:uppercase">
            {formatMonthLabel(program.month)}
          </p>
          <p className="truncate text-sm">{program.title}</p>
          <p className="text-muted-foreground text-xs">
            publié le {formatDate(program.publishedAt)}
          </p>
        </div>
        <OpenProgramButton programId={program.id} variant="outline" size="sm" />
      </Card>
    </li>
  );
}

export default async function DocumentsPage() {
  await requireSpace("formateur");
  const loaded = await loadPrograms();
  const currentMonth = monthOf(dakarIsoDate());

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Espace formateur"
        title="Documents"
        description="Le programme du mois et le règlement intérieur."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <ProgramSections
          {...splitPrograms(loaded.programs, currentMonth)}
          currentMonth={currentMonth}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Règlement intérieur</h2>
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Relisez à tout moment la version en vigueur du règlement.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/reglement">
              <ScrollText aria-hidden />
              Lire le règlement
            </Link>
          </Button>
        </Card>
      </section>
    </main>
  );
}

function ProgramSections({
  current,
  upcoming,
  previous,
  currentMonth,
}: ReturnType<typeof splitPrograms> & { currentMonth: string }) {
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Programme du mois</h2>
        {current ? (
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold first-letter:uppercase">
                {formatMonthLabel(current.month)}
              </p>
              <Badge variant="success">En vigueur</Badge>
            </div>
            <p className="text-sm">{current.title}</p>
            <p className="text-muted-foreground text-xs">
              publié le {formatDate(current.publishedAt)}
            </p>
            <div>
              <OpenProgramButton programId={current.id} />
            </div>
          </Card>
        ) : (
          <Card className="p-4 sm:p-5">
            <p className="text-muted-foreground">
              Le programme de {formatMonthLabel(currentMonth)} n&apos;est pas
              encore publié.
            </p>
          </Card>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">À venir</h2>
          <ul className="flex flex-col gap-3">
            {upcoming.map((program) => (
              <ProgramRow key={program.id} program={program} />
            ))}
          </ul>
        </section>
      )}

      {previous.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Mois précédents</h2>
          <ul className="flex flex-col gap-3">
            {previous.map((program) => (
              <ProgramRow key={program.id} program={program} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
