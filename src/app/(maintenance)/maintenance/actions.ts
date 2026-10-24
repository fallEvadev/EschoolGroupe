"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  resolveTicketSchema,
  startTicketSchema,
  type TicketResult,
} from "@/lib/validations/tickets";

/** Rôles qui travaillent sur les tickets (la base vérifie l'affectation). */
const WORK_ROLES = [
  "maintenancier",
  "admin_maintenance",
  "super_admin",
] as const;

/** Codes PostgreSQL renvoyés par `start_ticket` et `resolve_ticket`. */
const NOT_FOUND = "P0002";
const NOT_ALLOWED = "42501";
const CHECK_VIOLATION = "23514";

const ERREUR_GENERIQUE: TicketResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

function invalid(error: { issues: { message: string }[] }): TicketResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Données invalides.",
  };
}

/**
 * Traduit une erreur des fonctions SQL. Leurs messages sont écrits en français
 * dans la base et ne contiennent aucune donnée sensible : on les montre tels quels.
 */
function mapError(error: { code?: string; message: string }): TicketResult {
  if (
    error.code === NOT_FOUND ||
    error.code === NOT_ALLOWED ||
    error.code === CHECK_VIOLATION
  ) {
    return { ok: false, message: error.message };
  }
  console.error("tickets :", error.message);
  return ERREUR_GENERIQUE;
}

function refresh(ticketId: string) {
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/interventions");
  revalidatePath(`/maintenance/tickets/${ticketId}`);
  revalidatePath("/admin/maintenance");
}

/**
 * « Bien reçu » : prend un ticket en charge (il est affecté à l'appelant s'il ne
 * l'était pas) et prévient le formateur qui a signalé la panne. La base vérifie
 * que le ticket n'est pas confié à quelqu'un d'autre.
 */
export async function startTicket(input: unknown): Promise<TicketResult> {
  const caller = await requireActionRole(WORK_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = startTicketSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ticketId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc("start_ticket", {
      p_ticket_id: ticketId,
    });
    if (error) return mapError(error);

    await writeAudit({
      actorId: caller.actorId,
      action: "ticket_started",
      entity: "maintenance_tickets",
      entityId: ticketId,
      details: {},
    });
    refresh(ticketId);
    return {
      ok: true,
      message: "Bien reçu. Le formateur est prévenu.",
    };
  } catch (error) {
    console.error("startTicket :", error);
    return ERREUR_GENERIQUE;
  }
}

/** Marque un ticket résolu, avec la note d'intervention (jamais copiée dans l'audit). */
export async function resolveTicket(input: unknown): Promise<TicketResult> {
  const caller = await requireActionRole(WORK_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = resolveTicketSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ticketId, note } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc("resolve_ticket", {
      p_ticket_id: ticketId,
      p_note: note,
    });
    if (error) return mapError(error);

    await writeAudit({
      actorId: caller.actorId,
      action: "ticket_resolved",
      entity: "maintenance_tickets",
      entityId: ticketId,
      details: {},
    });
    refresh(ticketId);
    return { ok: true, message: "Ticket marqué résolu." };
  } catch (error) {
    console.error("resolveTicket :", error);
    return ERREUR_GENERIQUE;
  }
}
