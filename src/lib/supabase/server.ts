import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, routes API).
 * Il envoie le jeton Clerk de l'utilisateur : les politiques RLS s'appliquent
 * donc avec SON rôle. À utiliser par défaut.
 */
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Variables Supabase manquantes dans .env.local.");
  }

  const { getToken } = await auth();
  return createClient<Database>(url, anonKey, {
    accessToken: async () => getToken(),
  });
}
