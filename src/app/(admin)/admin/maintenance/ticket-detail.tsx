import { BackLink } from "@/components/layout/back-link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { sortMachines } from "@/lib/machines";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { canArchive, canAssign } from "@/lib/tickets";

import { LinkMachineForm, type MachineChoice } from "./link-machine-form";
import { TicketActions } from "./ticket-actions";

import { type TicketItem, type Team, StatusBadge } from "./tickets-data";

export async function TicketDetail({
  ticket,
  team,
  backHref,
  openMachineIds,
}: {
  ticket: TicketItem;
  team: Team;
  backHref: string;
  /** Machines qui ont déjà un ticket ouvert (le rattachement fusionnerait). */
  openMachineIds: string[];
}) {
  const supabase = await createServerSupabase();
  // Machines actives de l'école, proposées pour rattacher un « Autre équipement ».
  const linkable = !ticket.hasMachine && canAssign(ticket.status);
  const machinesResult = linkable
    ? await supabase
        .from("machines")
        .select("id, label")
        .eq("school_id", ticket.schoolId)
        .eq("status", "actif")
        .limit(500)
    : null;
  const openIds = new Set(openMachineIds);
  const machineChoices: MachineChoice[] = sortMachines(
    (machinesResult?.data ?? []).map((m) => ({ ...m, status: "actif" })),
  ).map((m) => ({
    id: m.id,
    label: m.label,
    hasOpenTicket: openIds.has(m.id),
  }));
  const { data, error } = await supabase
    .from("ticket_reports")
    .select("id, description, reported_by, reported_at")
    .eq("ticket_id", ticket.id)
    .order("reported_at", { ascending: false })
    .limit(200);

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-3 border-b p-4 sm:p-6">
        <BackLink href={backHref} className="lg:hidden">
          Retour aux tickets
        </BackLink>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold break-words">
              {ticket.equipmentLabel}
            </h2>
            <p className="text-muted-foreground text-sm">
              {ticket.schoolName} · ouvert le {formatDate(ticket.openedAt)}
              {ticket.resolvedAt &&
                ` · résolu le ${formatDate(ticket.resolvedAt)}`}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        {!ticket.hasMachine && (
          <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
            Équipement hors inventaire : le formateur ne l&apos;a pas trouvé
            dans la liste. Pensez à l&apos;ajouter dans « Parc informatique ».
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <TicketActions
          ticketId={ticket.id}
          equipmentLabel={ticket.equipmentLabel}
          assignedTo={ticket.assignedTo}
          maintenanciers={team.maintenanciers}
          assignable={canAssign(ticket.status)}
          archivable={canArchive(ticket.status)}
        />

        {linkable && (
          <LinkMachineForm
            ticketId={ticket.id}
            equipmentLabel={ticket.equipmentLabel}
            machines={machineChoices}
          />
        )}

        {ticket.resolutionNote && (
          <section className="flex flex-col gap-1">
            <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
              Note de résolution
            </h3>
            <p className="break-words">{ticket.resolutionNote}</p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
            Signalements ({data?.length ?? 0})
          </h3>
          {error ? (
            <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
              {describeSupabaseError("ticket_reports", error).message}
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-xl border">
              {data.map((report) => (
                <li key={report.id} className="flex flex-col gap-1 p-3 sm:p-4">
                  <p className="break-words">{report.description}</p>
                  <p className="text-muted-foreground text-sm">
                    {team.names.get(report.reported_by) ?? "Formateur"} ·{" "}
                    {formatDate(report.reported_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
