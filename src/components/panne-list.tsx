import { ChevronRight, School } from "lucide-react";
import Link from "next/link";

import { AcknowledgeButton } from "@/components/acknowledge-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import type { MyTicket } from "@/lib/maintenance-data";
import {
  groupBySchool,
  isTicketStatus,
  TICKET_BADGE,
  TICKET_LABELS,
} from "@/lib/tickets";

/**
 * Pannes signalées, une carte par école : le maintenancier voit d'un coup d'œil
 * quelles écoles ont des pannes, quel matériel est touché, et appuie sur
 * « Bien reçu » (le formateur est prévenu). Lisible sur téléphone.
 */
export function PanneList({
  tickets,
  empty,
}: {
  tickets: MyTicket[];
  /** Texte affiché quand il n'y a aucune panne. */
  empty: string;
}) {
  if (tickets.length === 0) {
    return (
      <Card className="text-muted-foreground p-6 text-center text-sm">
        {empty}
      </Card>
    );
  }

  const groups = groupBySchool(tickets);
  const schoolWord = groups.length > 1 ? "écoles ont" : "école a";
  const panneWord = tickets.length > 1 ? "pannes" : "panne";

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        {groups.length} {schoolWord} des pannes en cours ({tickets.length}{" "}
        {panneWord}).
      </p>

      {groups.map((group) => (
        <section
          key={group.schoolId}
          aria-label={group.schoolName}
          className="flex flex-col gap-2"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <School className="text-primary size-5" aria-hidden />
            {group.schoolName}
            <Badge variant="warning">
              {group.tickets.length}{" "}
              {group.tickets.length > 1 ? "pannes" : "panne"}
            </Badge>
          </h2>

          <ul className="flex flex-col gap-2">
            {group.tickets.map((ticket) => (
              <li key={ticket.id}>
                <Card className="flex flex-col gap-3 p-3 sm:p-4">
                  <Link
                    href={`/maintenance/tickets/${ticket.id}`}
                    className="hover:bg-muted -m-1 flex items-center gap-3 rounded-lg p-1 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {ticket.equipmentLabel}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        Signalé le {formatDate(ticket.openedAt)}
                        {ticket.reportCount > 1 &&
                          ` · ${ticket.reportCount} signalements`}
                      </span>
                    </span>
                    {isTicketStatus(ticket.status) && (
                      <Badge variant={TICKET_BADGE[ticket.status]}>
                        {TICKET_LABELS[ticket.status]}
                      </Badge>
                    )}
                    <ChevronRight
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden
                    />
                  </Link>
                  {ticket.status === "ouvert" && (
                    <AcknowledgeButton ticketId={ticket.id} />
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
