import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Vrai si l'URL et la clé publique sont présentes et l'URL bien formée.
 * Permet d'afficher un message clair au lieu de planter.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return (
    !!url &&
    /^https?:\/\//i.test(url) &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

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
