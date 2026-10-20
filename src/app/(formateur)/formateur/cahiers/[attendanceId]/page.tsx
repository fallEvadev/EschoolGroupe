import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { ReportContentView } from "@/components/report-content-view";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { dakarIsoDate, dakarMinutes, formatIsoLongDate } from "@/lib/dates";
import {
  departureMessage,
  departureStage,
  reportIsOpen,
} from "@/lib/departure";
import {
  emptyContent,
  isEditable,
  REPORT_BADGE,
  REPORT_LABELS,
  type ReportContent,
} from "@/lib/reports";
import { loadReportDetail } from "@/lib/reports-data";
import { formatTime } from "@/lib/schools";

import { ReportForm } from "../report-form";

export const metadata = { title: "Rapport · E-School" };

export default async function ReportPage({
  params,
}: PageProps<"/formateur/cahiers/[attendanceId]">) {
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
    const { report } = detail;
    const editable = report ? isEditable(report.status) : !detail.refused;
    // Pointage en deux temps : le rapport s'ouvre quand la descente est validée
    // (code du directeur, ou Direction pédagogique si le directeur est absent).
    const stage = departureStage({
      requiresDeparture: detail.departure.required,
      departedAt: detail.departure.departedAt,
      departureSource: detail.departure.source,
      endsAt: detail.endsAt,
      isToday: detail.date === dakarIsoDate(),
      nowMinutes: dakarMinutes(),
    });
    const closed = !report && !reportIsOpen(stage);
    const stageMessage = departureMessage(stage);

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
          {report && (
            <div>
              <Badge variant={REPORT_BADGE[report.status]}>
                {REPORT_LABELS[report.status]}
              </Badge>
            </div>
          )}
        </Card>

        {report?.status === "a_modifier" && report.reviewComment && (
          <p
            role="status"
            className="bg-warning-soft text-warning rounded-lg p-3 text-sm"
          >
            <span className="font-semibold">
              La Direction demande une modification :
            </span>{" "}
            {report.reviewComment}
          </p>
        )}

        {stageMessage && (closed || stage.stage === "done") && (
          <p
            role="status"
            className="bg-accent text-accent-foreground rounded-lg p-3 text-sm"
          >
            {stageMessage}
          </p>
        )}

        {stage.stage === "awaiting_code" && closed && (
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto"
          >
            <Link href={`/formateur/descente/${detail.attendanceId}`}>
              Saisir le code de descente
            </Link>
          </Button>
        )}

        {closed ? null : editable ? (
          <ReportForm
            attendanceId={detail.attendanceId}
            initial={
              report?.content ?? emptyContent(detail.startsAt, detail.endsAt)
            }
            machines={detail.machines}
          />
        ) : report ? (
          <ReadOnlyReport
            content={report.content}
            comment={report.reviewComment}
          />
        ) : (
          <Card className="p-4 text-sm sm:p-6">
            Ce pointage a été refusé par la Direction : il n&apos;y a pas de
            rapport à rédiger.
          </Card>
        )}
      </>
    );
  }

  return (
    <main className="flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <BackLink href="/formateur/cahiers">Mes rapports</BackLink>
      <PageHeader eyebrow="Rapport journalier" title="Rapport du cours" />
      {content}
    </main>
  );
}

/** Rapport envoyé ou validé : lecture seule. */
function ReadOnlyReport({
  content,
  comment,
}: {
  content: ReportContent;
  comment: string | null;
}) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <ReportContentView content={content} />
      {comment && (
        <div>
          <p className="text-muted-foreground text-sm">
            Commentaire de la Direction
          </p>
          <p className="whitespace-pre-wrap">{comment}</p>
        </div>
      )}
    </Card>
  );
}
