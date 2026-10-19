import { Wrench } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import {
  matchesFilter,
  sortTickets,
  TICKET_FILTER_LABELS,
  TICKET_FILTERS,
  type TicketFilter,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

import { StatsPanel } from "./stats-panel";

import {
  type Team,
  type LoadedTickets,
  href,
  StatusBadge,
} from "./tickets-data";

import { TicketDetail } from "./ticket-detail";

export async function TicketsContent({
  loaded,
  team,
  filter,
  ecole,
  ticketId,
}: {
  loaded: LoadedTickets;
  team: Team;
  filter: TicketFilter;
  ecole?: string;
  ticketId?: string;
}) {
  const visible = sortTickets(
    loaded.tickets.filter(
      (t) =>
        matchesFilter(t.status, filter) && (!ecole || t.schoolId === ecole),
    ),
  );
  const selected = ticketId
    ? loaded.tickets.find((t) => t.id === ticketId)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <StatsPanel stats={loaded.stats} schools={loaded.schools} />

      {/* Filtres : statut en liens, école en formulaire (fonctionne sans JavaScript) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
          {TICKET_FILTERS.map((f) => (
            <Link
              key={f}
              href={href(f, ecole)}
              aria-current={f === filter ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                f === filter
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {TICKET_FILTER_LABELS[f]}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex items-center gap-2">
          {filter !== "actifs" && (
            <input type="hidden" name="statut" value={filter} />
          )}
          <label htmlFor="filtre-ecole" className="sr-only">
            École
          </label>
          <select
            id="filtre-ecole"
            name="ecole"
            defaultValue={ecole ?? ""}
            className="border-input bg-card h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">Toutes les écoles</option>
            {loaded.schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="hover:bg-muted h-10 rounded-lg border px-3 text-sm font-medium"
          >
            Filtrer
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <Card
          className={cn(
            "flex flex-col gap-3 p-4 lg:p-5",
            selected && "hidden lg:flex",
          )}
        >
          <h2 className="text-lg font-semibold">Tickets ({visible.length})</h2>
          {visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {loaded.tickets.length === 0
                ? "Aucun ticket pour le moment. Ils apparaissent quand un formateur signale une panne dans son rapport."
                : "Aucun ticket ne correspond à ces filtres."}
            </p>
          ) : (
            <ul className="-mx-1 flex flex-col gap-1">
              {visible.map((t) => {
                const active = t.id === selected?.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={href(filter, ecole, t.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                        active
                          ? "border-primary bg-accent"
                          : "hover:bg-muted border-transparent",
                      )}
                    >
                      <Wrench
                        className="text-accent-foreground size-5 shrink-0"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {t.equipmentLabel}
                        </span>
                        <span className="text-muted-foreground block truncate text-sm">
                          {t.schoolName} · {formatDate(t.openedAt)}
                          {t.reportCount > 1 &&
                            ` · ${t.reportCount} signalements`}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {t.assignedTo
                            ? `Chargé : ${team.names.get(t.assignedTo) ?? "Compte inconnu"}`
                            : "Non affecté"}
                        </span>
                      </span>
                      <StatusBadge status={t.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected ? (
          <TicketDetail
            ticket={selected}
            team={team}
            backHref={href(filter, ecole)}
            openMachineIds={loaded.tickets
              .filter(
                (t) =>
                  t.machineId !== null &&
                  (t.status === "ouvert" || t.status === "en_cours"),
              )
              .map((t) => t.machineId as string)}
          />
        ) : (
          <Card className="text-muted-foreground hidden items-center justify-center p-10 text-center lg:flex">
            {ticketId
              ? "Ce ticket est introuvable."
              : "Sélectionnez un ticket pour voir ses signalements."}
          </Card>
        )}
      </div>
    </div>
  );
}
