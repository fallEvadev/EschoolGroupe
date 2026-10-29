import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatIsoLongDate } from "@/lib/dates";
import {
  courseLine,
  groupReportsByDay,
  schoolsOf,
  toPartnerReport,
  type PartnerReport,
} from "@/lib/partner-reports";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rapports · E-School" };

/**
 * Rapports validés des écoles du directeur connecté (30 derniers jours). La
 * fonction SQL `partner_reports` ne renvoie que les champs prévus des rapports
 * validés de ses écoles : il n'a aucun accès direct à la table des rapports.
 */
async function loadPartnerReports(): Promise<
  { reports: PartnerReport[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("partner_reports");
  if (error) {
    return { error: describeSupabaseError("partner_reports", error).message };
  }
  return { reports: data.map(toPartnerReport) };
}

export default async function PartnerReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ ecole?: string }>;
}) {
  await requireSpace("partenaire");
  const { ecole } = await searchParams;
  const loaded = await loadPartnerReports();

  const schools = "reports" in loaded ? schoolsOf(loaded.reports) : [];
  // Une école inconnue dans l'adresse est ignorée : on montre tout.
  const schoolId = schools.some((school) => school.id === ecole)
    ? (ecole ?? null)
    : null;
  const days =
    "reports" in loaded ? groupReportsByDay(loaded.reports, schoolId) : [];

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Portail partenaire"
        title="Rapports"
        description="Les rapports des formateurs de votre école, dès que la Direction pédagogique les a validés. Les 30 derniers jours sont affichés."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <>
          {schools.length > 1 && (
            <nav aria-label="Filtrer par école">
              <ul className="flex flex-wrap gap-2">
                {[{ id: null, name: "Toutes les écoles" }, ...schools].map(
                  (school) => {
                    const active = school.id === schoolId;
                    return (
                      <li key={school.id ?? "all"}>
                        <Link
                          href={
                            school.id
                              ? `/partenaire/rapports?ecole=${school.id}`
                              : "/partenaire/rapports"
                          }
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-full border px-4 py-2 text-sm font-medium",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {school.name}
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
            </nav>
          )}

          {days.length === 0 ? (
            <Card className="text-muted-foreground p-6 text-center text-sm">
              Aucun rapport validé pour le moment. Vous serez prévenu dès
              qu&apos;un rapport de votre école sera validé.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {days.map((day) => (
                <section key={day.date} className="flex flex-col gap-3">
                  <h2 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
                    {formatIsoLongDate(day.date)}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {day.reports.map((report) => (
                      <li key={report.id}>
                        <Card className="flex flex-col gap-3 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold break-words">
                                {report.formateur}
                              </p>
                              <p className="text-muted-foreground text-sm tabular-nums">
                                {report.schoolName} · {report.slot}
                              </p>
                            </div>
                            <Badge variant="success">Validé</Badge>
                          </div>
                          {report.courses.length > 0 && (
                            <ul className="flex flex-col gap-1 text-sm">
                              {report.courses.map((course, index) => (
                                <li key={index}>{courseLine(course)}</li>
                              ))}
                            </ul>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
