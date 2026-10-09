"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActionRole } from "@/lib/auth/action-guard";
import { NOTIFIED_ROLES } from "@/lib/notifications";
import { countUnread } from "@/lib/notifications-data";
import { createServerSupabase } from "@/lib/supabase/server";

const idSchema = z.uuid("Notification invalide.");

function refresh() {
  revalidatePath("/formateur/notifications");
  revalidatePath("/admin/notifications");
}

/**
 * Nombre de non-lues pour le badge, rafraîchi chaque minute. Réservé aux rôles
 * notifiés ; renvoie 0 pour tout autre appelant plutôt qu'une erreur.
 */
export async function getUnreadCount(): Promise<number> {
  const caller = await requireActionRole(NOTIFIED_ROLES);
  if (!caller.ok) return 0;
  return countUnread();
}

/**
 * Marque une notification comme lue. Jeton de l'utilisateur : la RLS ne
 * laisse modifier que les siennes, et seule la colonne `read_at` est ouverte.
 */
export async function markNotificationRead(id: unknown): Promise<void> {
  const caller = await requireActionRole(NOTIFIED_ROLES);
  if (!caller.ok) return;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("read_at", null);
  if (error) console.error("notifications :", error.message);
  refresh();
}

/** Marque toutes les notifications non lues comme lues. */
export async function markAllNotificationsRead(): Promise<void> {
  const caller = await requireActionRole(NOTIFIED_ROLES);
  if (!caller.ok) return;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) console.error("notifications :", error.message);
  refresh();
}
