import "server-only";

import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const CONFIG_ERROR =
  "Le service n'est pas encore configuré. Contactez l'administrateur technique.";

/** Un ticket tel que le maintenancier le voit dans ses listes. */
export type MyTicket = {
  id: string;
  schoolName: string;
  equipmentLabel: string;
  status: string;
  openedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  reportCount: number;
};

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function schoolNames(
  supabase: ServerSupabase,
): Promise<Map<string, string> | { error: string }> {
  const { data, error } = await supabase.rpc("maintenance_schools");
  if (error) {
    return {
      error: describeSupabaseError("maintenance_schools", error).message,
    };
  }
  return new Map(data.map((s) => [s.id, s.name]));
}

/**
 * Tickets visibles par l'appelant dans ces statuts. Lu avec SON jeton : la RLS
 * ne montre à un maintenancier que les tickets qui lui sont affectés.
 */
export async function loadMyTickets(
  statuses: string[],
): Promise<{ tickets: MyTicket[] } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();

  const [ticketsResult, schools] = await Promise.all([
    supabase
      .from("maintenance_tickets")
      .select(
        "id, school_id, equipment_label, status, opened_at, started_at, resolved_at",
      )
      .in("status", statuses)
      .order("opened_at", { ascending: false })
      .limit(300),
    schoolNames(supabase),
  ]);
  if (ticketsResult.error) {
    return {
      error: describeSupabaseError("maintenance_tickets", ticketsResult.error)
        .message,
    };
  }
  if ("error" in schools) return schools;

  const ids = ticketsResult.data.map((t) => t.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const reports = await supabase
      .from("ticket_reports")
      .select("ticket_id")
      .in("ticket_id", ids)
      .limit(3000);
    if (reports.error) {
      return {
        error: describeSupabaseError("ticket_reports", reports.error).message,
      };
    }
    for (const row of reports.data) {
      counts.set(row.ticket_id, (counts.get(row.ticket_id) ?? 0) + 1);
    }
  }

  return {
    tickets: ticketsResult.data.map((t) => ({
      id: t.id,
      schoolName: schools.get(t.school_id) ?? "École",
      equipmentLabel: t.equipment_label,
      status: t.status,
      openedAt: t.opened_at,
      startedAt: t.started_at,
      resolvedAt: t.resolved_at,
      reportCount: counts.get(t.id) ?? 0,
    })),
  };
}

export type TicketDetail = MyTicket & {
  resolutionNote: string | null;
  /** Type et numéro de série de la machine, si le ticket en a une. */
  machine: { kind: string; serialNumber: string | null } | null;
  reports: { id: string; description: string; reportedAt: string }[];
};

/**
 * Détail d'un ticket. `null` s'il n'existe pas ou n'est pas visible par
 * l'appelant (la RLS le masque). Les noms des formateurs ne sont pas lus.
 */
export async function loadTicketDetail(
  ticketId: string,
): Promise<TicketDetail | null | { error: string }> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();

  const ticketResult = await supabase
    .from("maintenance_tickets")
    .select(
      "id, school_id, machine_id, equipment_label, status, opened_at, started_at, resolved_at, resolution_note",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketResult.error) {
    return {
      error: describeSupabaseError("maintenance_tickets", ticketResult.error)
        .message,
    };
  }
  const ticket = ticketResult.data;
  if (!ticket) return null;

  const [schools, reportsResult, machineResult] = await Promise.all([
    schoolNames(supabase),
    supabase
      .from("ticket_reports")
      .select("id, description, reported_at")
      .eq("ticket_id", ticketId)
      .order("reported_at", { ascending: false })
      .limit(200),
    ticket.machine_id
      ? supabase
          .from("machines")
          .select("kind, serial_number")
          .eq("id", ticket.machine_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if ("error" in schools) return schools;
  if (reportsResult.error) {
    return {
      error: describeSupabaseError("ticket_reports", reportsResult.error)
        .message,
    };
  }
  if (machineResult.error) {
    return {
      error: describeSupabaseError("machines", machineResult.error).message,
    };
  }

  return {
    id: ticket.id,
    schoolName: schools.get(ticket.school_id) ?? "École",
    equipmentLabel: ticket.equipment_label,
    status: ticket.status,
    openedAt: ticket.opened_at,
    startedAt: ticket.started_at,
    resolvedAt: ticket.resolved_at,
    resolutionNote: ticket.resolution_note,
    reportCount: reportsResult.data.length,
    machine: machineResult.data
      ? {
          kind: machineResult.data.kind,
          serialNumber: machineResult.data.serial_number,
        }
      : null,
    reports: reportsResult.data.map((r) => ({
      id: r.id,
      description: r.description,
      reportedAt: r.reported_at,
    })),
  };
}
