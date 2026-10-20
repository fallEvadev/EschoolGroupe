import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { machineKindLabel } from "@/lib/machines";
import { loadTicketDetail } from "@/lib/maintenance-data";
import { isTicketStatus, TICKET_BADGE, TICKET_LABELS } from "@/lib/tickets";

import { TicketWorkForm } from "./ticket-work-form";

export const metadata = { title: "Ticket · E-School" };

export default async function TicketPage({
  params,
}: PageProps<"/maintenance/tickets/[id]">) {
  await requireSpace("maintenance");
  const { id } = await params;
  const detail = await loadTicketDetail(id);

  if (detail === null) notFound();

  if ("error" in detail) {
    return (
      <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {detail.error}
        </p>
      </main>
    );
  }

  const status = isTicketStatus(detail.status) ? detail.status : null;
  const workable = detail.status === "ouvert" || detail.status === "en_cours";

  return (
    <main className="flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-8">
      <BackLink href={workable ? "/maintenance" : "/maintenance/interventions"}>
        Retour aux tickets
      </BackLink>

      <PageHeader
        eyebrow={detail.schoolName}
        title={detail.equipmentLabel}
        description={
          detail.machine
            ? `${machineKindLabel(detail.machine.kind)}${detail.machine.serialNumber ? ` · N° ${detail.machine.serialNumber}` : ""}`
            : "Équipement hors inventaire"
        }
        actions={
          status ? (
            <Badge variant={TICKET_BADGE[status]} className="w-fit">
              {TICKET_LABELS[status]}
            </Badge>
          ) : undefined
        }
      />

      <Card className="flex flex-col gap-1 p-4 text-sm">
        <p>Signalé le {formatDate(detail.openedAt)}</p>
        {detail.startedAt && (
          <p>Pris en charge le {formatDate(detail.startedAt)}</p>
        )}
        {detail.resolvedAt && <p>Résolu le {formatDate(detail.resolvedAt)}</p>}
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:p-6">
        <h2 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
          Signalements ({detail.reports.length})
        </h2>
        <ul className="divide-border divide-y rounded-xl border">
          {detail.reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-1 p-3">
              <p className="break-words">{report.description}</p>
              <p className="text-muted-foreground text-sm">
                {formatDate(report.reportedAt)}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {detail.resolutionNote && (
        <Card className="flex flex-col gap-1 p-4 sm:p-6">
          <h2 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
            Note d&apos;intervention
          </h2>
          <p className="break-words">{detail.resolutionNote}</p>
        </Card>
      )}

      {workable && (
        <Card className="p-4 sm:p-6">
          <TicketWorkForm
            ticketId={detail.id}
            status={detail.status === "ouvert" ? "ouvert" : "en_cours"}
          />
        </Card>
      )}
    </main>
  );
}
