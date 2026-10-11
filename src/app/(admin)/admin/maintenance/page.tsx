import { ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { parseRole } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { computeTicketStats, type TicketStats } from "@/lib/ticket-stats";
import {
  canArchive,
  canAssign,
  isTicketStatus,
  matchesFilter,
  parseTicketFilter,
  sortTickets,
  TICKET_BADGE,
  TICKET_FILTER_LABELS,
  TICKET_FILTERS,
  TICKET_LABELS,
  type TicketFilter,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

import { requireMaintenanceManager } from "../parc/access";
import { StatsPanel } from "./stats-panel";
import { TicketActions, type MaintenancierOption } from "./ticket-actions";

export const metadata = { title: "Maintenance · E-School Groupe" };

const CONFIG_ERROR =
  "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.";

type TicketItem = {
  id: string;
  schoolId: string;
  schoolName: string;
  equipmentLabel: string;
  hasMachine: boolean;
  status: string;
  assignedTo: string | null;
  openedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  reportCount: number;
};

type Team = {
  names: Map<string, string>;
  maintenanciers: MaintenancierOption[];
};

/** Annuaire minimal : maintenanciers (affectation) et formateurs (qui a signalé). */
async function loadTeam(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
): Promise<Team> {
  const { data, error } = await supabase.rpc("maintenance_team_directory");
  if (error) {
    console.error("maintenance_team_directory :", error.message);
    return { names: new Map(), maintenanciers: [] };
  }
  const names = new Map(data.map((p) => [p.id, p.full_name]));
  const maintenanciers = data
    .filter(
      (p) => parseRole(p.role) === "maintenancier" && p.status === "actif",
    )
    .map((p) => ({ id: p.id, name: p.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { names, maintenanciers };
}

type LoadedTickets = {
  tickets: TicketItem[];
  schools: { id: string; name: string }[];
  stats: TicketStats;
};

async function loadTickets(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
): Promise<LoadedTickets | { error: string }> {
  const [ticketsResult, schoolsResult] = await Promise.all([
    supabase
      .from("maintenance_tickets")
      .select(
        "id, school_id, machine_id, equipment_label, status, assigned_to, opened_at, resolved_at, resolution_note",
      )
      .order("opened_at", { ascending: false })
      .limit(500),
    supabase.rpc("maintenance_schools"),
  ]);
  if (ticketsResult.error) {
    return {
      error: describeSupabaseError("maintenance_tickets", ticketsResult.error)
        .message,
    };
  }
  if (schoolsResult.error) {
    return {
      error: describeSupabaseError("maintenance_schools", schoolsResult.error)
        .message,
    };
  }

  const ids = ticketsResult.data.map((t) => t.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const reports = await supabase
      .from("ticket_reports")
      .select("ticket_id")
      .in("ticket_id", ids)
      .limit(5000);
    if (reports.error) {
      return {
        error: describeSupabaseError("ticket_reports", reports.error).message,
      };
    }
    for (const row of reports.data) {
      counts.set(row.ticket_id, (counts.get(row.ticket_id) ?? 0) + 1);
    }
  }

  const schoolNames = new Map(schoolsResult.data.map((s) => [s.id, s.name]));
  return {
    // Calculées ici (hors composant) : le calcul dépend de l'heure courante.
    stats: computeTicketStats(
      ticketsResult.data.map((t) => ({
        schoolId: t.school_id,
        status: t.status,
        openedAt: t.opened_at,
        resolvedAt: t.resolved_at,
      })),
      new Date(),
    ),
    schools: schoolsResult.data
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    tickets: ticketsResult.data.map((t) => ({
      id: t.id,
      schoolId: t.school_id,
      schoolName: schoolNames.get(t.school_id) ?? "École",
      equipmentLabel: t.equipment_label,
      hasMachine: t.machine_id !== null,
      status: t.status,
      assignedTo: t.assigned_to,
      openedAt: t.opened_at,
      resolvedAt: t.resolved_at,
      resolutionNote: t.resolution_note,
      reportCount: counts.get(t.id) ?? 0,
    })),
  };
}

function href(filter: TicketFilter, ecole?: string, ticket?: string): string {
  const params = new URLSearchParams();
  if (filter !== "actifs") params.set("statut", filter);
  if (ecole) params.set("ecole", ecole);
  if (ticket) params.set("ticket", ticket);
  const query = params.toString();
  return query ? `/admin/maintenance?${query}` : "/admin/maintenance";
}

function StatusBadge({ status }: { status: string }) {
  return isTicketStatus(status) ? (
    <Badge variant={TICKET_BADGE[status]}>{TICKET_LABELS[status]}</Badge>
  ) : (
    <Badge variant="neutral">{status}</Badge>
  );
}

export default async function MaintenancePage({
  searchParams,
}: PageProps<"/admin/maintenance">) {
  await requireMaintenanceManager();
  const params = await searchParams;
  const filter = parseTicketFilter(params.statut);
  const ecole = typeof params.ecole === "string" ? params.ecole : undefined;
  const ticketId =
    typeof params.ticket === "string" ? params.ticket : undefined;

  if (!isSupabaseConfigured()) {
    return (
      <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <PageHeader eyebrow="Maintenance" title="Tickets de pannes" />
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {CONFIG_ERROR}
        </p>
      </main>
    );
  }

  const supabase = await createServerSupabase();
  const [loaded, team] = await Promise.all([
    loadTickets(supabase),
    loadTeam(supabase),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Tickets de pannes"
        description="Les pannes signalées par les formateurs dans leurs rapports. Une machine déjà en panne regroupe ses signalements dans un seul ticket."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <TicketsContent
          loaded={loaded}
          team={team}
          filter={filter}
          ecole={ecole}
          ticketId={ticketId}
        />
      )}
    </main>
  );
}

async function TicketsContent({
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

async function TicketDetail({
  ticket,
  team,
  backHref,
}: {
  ticket: TicketItem;
  team: Team;
  backHref: string;
}) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ticket_reports")
    .select("id, description, reported_by, reported_at")
    .eq("ticket_id", ticket.id)
    .order("reported_at", { ascending: false })
    .limit(200);

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-3 border-b p-4 sm:p-6">
        <Link
          href={backHref}
          className="text-primary flex items-center gap-1 text-sm font-medium lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour aux tickets
        </Link>
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
