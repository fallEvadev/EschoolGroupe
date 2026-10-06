import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Role } from "@/lib/auth/roles";
import { mustAcceptRules } from "@/lib/rules";
import { classifySupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type CurrentRules = {
  id: string;
  version: number;
  title: string;
  content: string;
  publishedAt: string;
};

/**
 * Erreur de mise en place (migration pas encore appliquée, liaison Clerk
 * absente) : on ne bloque personne. Toute autre erreur est remontée.
 */
function failOrSkip(
  context: string,
  error: { code?: string; message: string },
): void {
  if (classifySupabaseError(error) !== "other") return;
  throw new Error(`${context} : ${error.message}`);
}

/**
 * Version en vigueur du règlement (la plus récente), ou `null` s'il n'y en a
 * pas encore. Lue avec le jeton de l'utilisateur : la RLS s'applique.
 * Mise en cache le temps d'une requête.
 */
export const getCurrentRules = cache(
  async (): Promise<CurrentRules | null> => {
    if (!isSupabaseConfigured()) return null;

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("internal_rules")
      .select("id, version, title, content, published_at")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      failOrSkip("internal_rules", error);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      version: data.version,
      title: data.title,
      content: data.content,
      publishedAt: data.published_at,
    };
  },
);

/** Identifiant de la fiche de l'utilisateur connecté (`null` s'il n'en a pas). */
export const getOwnProfileId = cache(async (): Promise<string | null> => {
  const { userId } = await auth();
  if (!userId || !isSupabaseConfigured()) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error) {
    failOrSkip("profiles", error);
    return null;
  }
  return data?.id ?? null;
});

/**
 * L'utilisateur connecté a-t-il accepté cette version ? Filtre sur sa propre
 * fiche : un administrateur voit toutes les acceptations, il ne doit pas
 * compter celles des autres.
 */
export async function hasAcceptedRules(rulesId: string): Promise<boolean> {
  const profileId = await getOwnProfileId();
  if (!profileId) return false;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("document_acceptances")
    .select("id")
    .eq("rules_id", rulesId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) {
    failOrSkip("document_acceptances", error);
    return true; // mise en place incomplète : on ne bloque pas
  }
  return data !== null;
}

/**
 * Contrôle à placer dans le layout des espaces concernés : tant que la
 * version en vigueur n'est pas acceptée, on renvoie vers `/reglement`.
 * Les rôles non concernés et l'absence de règlement publié passent sans blocage.
 */
export async function requireRulesAccepted(role: Role): Promise<void> {
  if (!mustAcceptRules(role)) return;

  const rules = await getCurrentRules();
  if (!rules) return;

  if (!(await hasAcceptedRules(rules.id))) redirect("/reglement");
}
