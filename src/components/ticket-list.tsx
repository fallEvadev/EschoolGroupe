import { ChevronRight, Wrench } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MyTicket } from "@/lib/maintenance-data";
import { formatDate } from "@/lib/dates";
import { isTicketStatus, TICKET_BADGE, TICKET_LABELS } from "@/lib/tickets";

/** Liste de tickets du maintenancier : une carte par ticket, lisible sur téléphone. */
export function TicketList({
  tickets,
  empty,
}: {
  tickets: MyTicket[];
  /** Texte affiché quand il n'y a aucun ticket. */
  empty: string;
}) {
  if (tickets.length === 0) {
    return (
      <Card className="text-muted-foreground p-6 text-center text-sm">
        {empty}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/maintenance/tickets/${ticket.id}`}
            className="bg-card hover:bg-muted flex items-center gap-3 rounded-xl border p-3 transition-colors"
          >
            <span
              aria-hidden
              className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              <Wrench className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {ticket.equipmentLabel}
              </span>
              <span className="text-muted-foreground block truncate text-sm">
                {ticket.schoolName} ·{" "}
                {ticket.resolvedAt
                  ? `résolu le ${formatDate(ticket.resolvedAt)}`
                  : `signalé le ${formatDate(ticket.openedAt)}`}
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
        </li>
      ))}
    </ul>
  );
}
