import "server-only";

import type { NotificationItem } from "@/lib/notifications";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

/** Combien de notifications la page affiche (les plus récentes). */
const LIST_LIMIT = 50;

/**
 * Nombre de notifications non lues de l'utilisateur connecté. Lu avec SON
 * jeton : la RLS ne compte que les siennes. Une erreur renvoie 0 (le badge ne
 * doit jamais casser une page).
 */
export async function countUnread(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) {
    console.error("notifications :", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Dernières notifications de l'utilisateur connecté, les plus récentes d'abord. */
export async function loadNotifications(): Promise<
  { items: NotificationItem[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) {
    return { error: describeSupabaseError("notifications", error).message };
  }
  return {
    items: data.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      link: row.link,
      createdAt: row.created_at,
      read: row.read_at !== null,
    })),
  };
}
