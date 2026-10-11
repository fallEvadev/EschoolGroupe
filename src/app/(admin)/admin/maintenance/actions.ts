"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  archiveTicketSchema,
  assignTicketSchema,
  linkTicketSchema,
  type TicketResult,
} from "@/lib/validations/tickets";

import { MAINTENANCE_MANAGER_ROLES } from "../parc/access";

/** Code PostgreSQL d'une règle de la base refusée (garde-fou d'affectation). */
const CHECK_VIOLATION = "23514";

const ERREUR_GENERIQUE: TicketResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

const INTROUVABLE: TicketResult = {
  ok: false,
  message: "Ce ticket est introuvable ou n'est plus modifiable.",
};

function invalid(error: { issues: { message: string }[] }): TicketResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Données invalides.",
  };
}

function refresh() {
  revalidatePath("/admin/maintenance");
}

/**
 * Affecte un ticket à un maintenancier (ou retire l'affectation). Le jeton de
 * l'utilisateur est utilisé : la RLS réserve la mise à jour à la gestion de la
 * maintenance, et un déclencheur SQL vérifie que la personne est bien un
 * maintenancier actif et que le ticket n'est ni résolu ni archivé.
 */
export async function assignTicket(input: unknown): Promise<TicketResult> {
  const caller = await requireActionRole(MAINTENANCE_MANAGER_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = assignTicketSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ticketId, profileId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("maintenance_tickets")
      .update({ assigned_to: profileId })
      .eq("id", ticketId)
      .in("status", ["ouvert", "en_cours"])
      .select("id");
    if (error) {
      if (error.code === CHECK_VIOLATION) {
        // Messages écrits en français dans la base, sans donnée sensible.
        return { ok: false, message: error.message };
      }
      console.error("maintenance_tickets :", error.message);
      return ERREUR_GENERIQUE;
    }
    // Refus de la RLS, ticket inconnu ou déjà résolu : aucune ligne modifiée.
    if (updated.length === 0) return INTROUVABLE;

    await writeAudit({
      actorId: caller.actorId,
      action: profileId ? "ticket_assigned" : "ticket_unassigned",
      entity: "maintenance_tickets",
      entityId: ticketId,
      details: {},
    });
    refresh();
    return {
      ok: true,
      message: profileId ? "Ticket affecté." : "Affectation retirée.",
    };
  } catch (error) {
    console.error("assignTicket :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Rattache un ticket « Autre équipement » à une machine de l'inventaire. Si la
 * machine a déjà un ticket ouvert, les deux sont fusionnés (le ticket « Autre »
 * est archivé, ses signalements rejoignent l'autre). La fonction SQL fait tous
 * les contrôles : école, machine active, statut du ticket, rôle.
 */
export async function linkTicketToMachine(
  input: unknown,
): Promise<TicketResult> {
  const caller = await requireActionRole(MAINTENANCE_MANAGER_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = linkTicketSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ticketId, machineId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("link_ticket_to_machine", {
      p_ticket_id: ticketId,
      p_machine_id: machineId,
    });
    if (error) {
      // Messages écrits en français dans la base, sans donnée sensible.
      if (
        error.code === "P0002" ||
        error.code === "42501" ||
        error.code === CHECK_VIOLATION
      ) {
        return { ok: false, message: error.message };
      }
      console.error("link_ticket_to_machine :", error.message);
      return ERREUR_GENERIQUE;
    }

    const merged = data === "fusionne";
    await writeAudit({
      actorId: caller.actorId,
      action: merged ? "ticket_merged" : "ticket_linked_to_machine",
      entity: "maintenance_tickets",
      entityId: ticketId,
      details: {},
    });
    refresh();
    return {
      ok: true,
      message: merged
        ? "Tickets fusionnés : les signalements ont rejoint le ticket de la machine."
        : "Ticket rattaché à la machine.",
    };
  } catch (error) {
    console.error("linkTicketToMachine :", error);
    return ERREUR_GENERIQUE;
  }
}

/**
 * Archive un ticket ouvert (fausse alerte) ou résolu (rangement). Un ticket en
 * cours est en train d'être traité : il se résout d'abord. Rien n'est supprimé.
 */
export async function archiveTicket(input: unknown): Promise<TicketResult> {
  const caller = await requireActionRole(MAINTENANCE_MANAGER_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = archiveTicketSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ticketId } = parsed.data;

  try {
    const supabase = await createServerSupabase();
    const { data: updated, error } = await supabase
      .from("maintenance_tickets")
      .update({ status: "archive" })
      .eq("id", ticketId)
      .in("status", ["ouvert", "resolu"])
      .select("id");
    if (error) {
      console.error("maintenance_tickets :", error.message);
      return ERREUR_GENERIQUE;
    }
    if (updated.length === 0) return INTROUVABLE;

    await writeAudit({
      actorId: caller.actorId,
      action: "ticket_archived",
      entity: "maintenance_tickets",
      entityId: ticketId,
      details: {},
    });
    refresh();
    return { ok: true, message: "Ticket archivé." };
  } catch (error) {
    console.error("archiveTicket :", error);
    return ERREUR_GENERIQUE;
  }
}
