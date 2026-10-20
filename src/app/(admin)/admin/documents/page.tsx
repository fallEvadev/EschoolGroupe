import { FileText, ScrollText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { OpenProgramButton } from "@/components/open-program-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { bilanTitle, periodLabel } from "@/lib/bilans";
import {
  dakarIsoDate,
  formatDate,
  formatMonthLabel,
  monthOf,
} from "@/lib/dates";
import { loadPublishedBilans } from "@/lib/documents-data";
import { getCurrentRules } from "@/lib/internal-rules";
import { splitPrograms } from "@/lib/programs";
import { loadPrograms } from "@/lib/programs-data";

export const metadata = { title: "Documents · E-School" };

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-6">
      <h2 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
      {children}
    </p>
  );
}

/**
 * Les documents de la plateforme au même endroit : règlement en vigueur,
 * programme du mois et derniers bilans publiés. Chaque document s'ouvre par la
 * même voie que sur sa page (lien signé de courte durée) ; la Direction
 * pédagogique voit programmes et bilans, l'Admin RH voit le règlement.
 */
export default async function DocumentsPage() {
  const role = await requireSpace("admin");
  if (
    role !== "admin_pedagogie" &&
    role !== "admin_rh" &&
    role !== "super_admin"
  ) {
    redirect("/non-autorise");
  }
  const isPedagogy = role === "admin_pedagogie" || role === "super_admin";

  const rules = await getCurrentRules().catch(() => null);
  const [programs, bilans] = isPedagogy
    ? await Promise.all([loadPrograms(), loadPublishedBilans()])
    : [null, null];

  const currentProgram =
    programs && !("error" in programs)
      ? splitPrograms(programs.programs, monthOf(dakarIsoDate(new Date())))
          .current
      : null;

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Organisation"
        title="Documents"
        description="Le règlement, le programme du mois et les derniers bilans, au même endroit."
      />

      <Block title="Règlement intérieur">
        {rules ? (
          <>
            <p className="font-medium">{rules.title}</p>
            <p className="text-muted-foreground text-sm">
              Version {rules.version} · publiée le{" "}
              {formatDate(rules.publishedAt)}
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:self-start"
              asChild
            >
              <Link href="/reglement">
                <ScrollText aria-hidden />
                Lire le règlement
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucun règlement n&apos;est publié pour le moment.
          </p>
        )}
      </Block>

      {isPedagogy && (
        <>
          <Block title="Programme du mois">
            {programs && "error" in programs ? (
              <Problem>{programs.error}</Problem>
            ) : currentProgram ? (
              <>
                <p className="font-medium first-letter:uppercase">
                  {formatMonthLabel(currentProgram.month)}
                </p>
                <p className="text-sm">{currentProgram.title}</p>
                <div>
                  <OpenProgramButton
                    programId={currentProgram.id}
                    variant="outline"
                  />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucun programme n&apos;est publié pour ce mois.
              </p>
            )}
          </Block>

          <Block title="Derniers bilans publiés">
            {bilans && "error" in bilans ? (
              <Problem>{bilans.error}</Problem>
            ) : !bilans || bilans.bilans.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun bilan n&apos;est publié pour le moment.
              </p>
            ) : (
              <ul className="divide-border divide-y rounded-xl border">
                {bilans.bilans.map((bilan) => (
                  <li
                    key={bilan.id}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{bilan.schoolName}</p>
                      <p className="text-muted-foreground text-sm">
                        {bilanTitle(bilan.kind)} ·{" "}
                        {periodLabel(bilan.kind, bilan.periodStart)} · publié le{" "}
                        {formatDate(bilan.publishedAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      asChild
                    >
                      <a
                        href={`/admin/bilans/${bilan.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText aria-hidden />
                        Voir le PDF
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </>
      )}
    </main>
  );
}
