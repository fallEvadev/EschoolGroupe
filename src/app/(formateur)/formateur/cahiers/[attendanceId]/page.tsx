import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatIsoLongDate } from "@/lib/dates";
import {
  EMPTY_CONTENT,
  isEditable,
  REPORT_BADGE,
  REPORT_LABELS,
  type ReportContent,
} from "@/lib/reports";
import { loadReportDetail } from "@/lib/reports-data";
import { formatTime } from "@/lib/schools";

import { ReportForm } from "../report-form";

export const metadata = { title: "Rapport · E-School Groupe" };

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

        {editable ? (
          <ReportForm
            attendanceId={detail.attendanceId}
            initial={report?.content ?? EMPTY_CONTENT}
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
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <Link
        href="/formateur/cahiers"
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mes rapports
      </Link>
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
      <div>
        <p className="text-muted-foreground text-sm">Classe(s)</p>
        <p>{content.classes}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Thème du cours</p>
        <p className="whitespace-pre-wrap">{content.courseTheme}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Matériel</p>
        {content.equipmentOk ? (
          <p>Tout fonctionne.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {content.issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{issue.equipment}</span> :{" "}
                {issue.description}
              </li>
            ))}
          </ul>
        )}
      </div>
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
