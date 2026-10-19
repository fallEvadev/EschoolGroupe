import { Badge } from "@/components/ui/badge";
import { parseRole } from "@/lib/auth/roles";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { computeTicketStats, type TicketStats } from "@/lib/ticket-stats";
import {
  isTicketStatus,
  TICKET_BADGE,
  TICKET_LABELS,
  type TicketFilter,
} from "@/lib/tickets";

import { type MaintenancierOption } from "./ticket-actions";

export const CONFIG_ERROR =
  "Le service n'est pas encore configuré. Contactez l'administrateur technique.";

export type TicketItem = {
  id: string;
  schoolId: string;
  schoolName: string;
  equipmentLabel: string;
  hasMachine: boolean;
  machineId: string | null;
  status: string;
  assignedTo: string | null;
  openedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  reportCount: number;
};

export type Team = {
  names: Map<string, string>;
  maintenanciers: MaintenancierOption[];
};

/** Annuaire minimal : maintenanciers (affectation) et formateurs (qui a signalé). */
export async function loadTeam(
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

export type LoadedTickets = {
  tickets: TicketItem[];
  schools: { id: string; name: string }[];
  stats: TicketStats;
};

export async function loadTickets(
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
      machineId: t.machine_id,
      status: t.status,
      assignedTo: t.assigned_to,
      openedAt: t.opened_at,
      resolvedAt: t.resolved_at,
      resolutionNote: t.resolution_note,
      reportCount: counts.get(t.id) ?? 0,
    })),
  };
}

export function href(
  filter: TicketFilter,
  ecole?: string,
  ticket?: string,
): string {
  const params = new URLSearchParams();
  if (filter !== "actifs") params.set("statut", filter);
  if (ecole) params.set("ecole", ecole);
  if (ticket) params.set("ticket", ticket);
  const query = params.toString();
  return query ? `/admin/maintenance?${query}` : "/admin/maintenance";
}

export function StatusBadge({ status }: { status: string }) {
  return isTicketStatus(status) ? (
    <Badge variant={TICKET_BADGE[status]}>{TICKET_LABELS[status]}</Badge>
  ) : (
    <Badge variant="neutral">{status}</Badge>
  );
}
