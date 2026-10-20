import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { dakarIsoDate, dakarMinutes, formatIsoLongDate } from "@/lib/dates";
import { departureMessage, departureStage } from "@/lib/departure";
import { loadReportDetail } from "@/lib/reports-data";
import { formatTime } from "@/lib/schools";

import { DepartureForm } from "./departure-form";

export const metadata = { title: "Descente · E-School" };

/**
 * Validation de la descente : le formateur saisit le code que le directeur lui
 * donne une fois le cours terminé. Le formulaire n'apparaît qu'à partir de la
 * fin du créneau ; le serveur refuse de toute façon un code donné trop tôt.
 * C'est la validation de la descente qui ouvre le rapport journalier.
 */
export default async function DeparturePage({
  params,
}: PageProps<"/formateur/descente/[attendanceId]">) {
  await requireSpace("formateur");
  const { attendanceId } = await params;
  const detail = await loadReportDetail(attendanceId);

  if (detail === null) notFound();

  let content: React.ReactNode;
  if ("error" in detail) {
    content = (
      <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
        {detail.error}
      </p>
    );
  } else {
    const stage = departureStage({
      requiresDeparture: detail.departure.required,
      departedAt: detail.departure.departedAt,
      departureSource: detail.departure.source,
      endsAt: detail.endsAt,
      isToday: detail.date === dakarIsoDate(),
      nowMinutes: dakarMinutes(),
    });

    content = (
      <>
        <Card className="flex flex-col gap-1 p-4">
          <p className="font-semibold first-letter:uppercase">
            {formatIsoLongDate(detail.date)}
          </p>
          <p className="text-muted-foreground text-sm">
            {detail.schoolName}
            {detail.startsAt &&
              ` · ${formatTime(detail.startsAt)}–${formatTime(detail.endsAt)}`}
          </p>
        </Card>

        {stage.stage === "awaiting_code" ? (
          <Card className="p-4 sm:p-6">
            <DepartureForm attendanceId={detail.attendanceId} />
          </Card>
        ) : (
          <Card className="p-4 text-sm sm:p-6">
            {stage.stage === "legacy"
              ? "Ce pointage n'a pas de descente à valider."
              : stage.stage === "closed"
                ? `Le cours n'est pas terminé : le code de descente sera accepté à partir de ${formatTime(detail.endsAt)}.`
                : departureMessage(stage)}
          </Card>
        )}
      </>
    );
  }

  return (
    <main className="flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <BackLink href="/formateur">Accueil</BackLink>
      <PageHeader eyebrow="Fin du cours" title="Valider ma descente" />
      {content}
    </main>
  );
}
