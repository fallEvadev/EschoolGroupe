import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Client Supabase « administrateur » : CONTOURNE la RLS.
 * Réservé au serveur (Server Actions, routes API, webhooks) et uniquement
 * pour des opérations que l'utilisateur ne peut pas faire lui-même
 * (ex. créer un profil à l'activation d'un compte). Vérifier les droits
 * de l'appelant AVANT de l'utiliser.
 */
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Variables Supabase manquantes dans .env.local.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
