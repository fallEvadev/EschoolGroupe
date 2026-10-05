"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

import type { Database } from "@/types/database";

/**
 * Client Supabase côté navigateur (composants interactifs).
 * Il envoie le jeton Clerk : la RLS s'applique avec le rôle de l'utilisateur.
 * Ne jamais y utiliser la clé service_role.
 */
export function useSupabase() {
  const { session } = useSession();

  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Variables Supabase manquantes dans .env.local.");
    }
    return createClient<Database>(url, anonKey, {
      accessToken: async () => session?.getToken() ?? null,
    });
  }, [session]);
}
