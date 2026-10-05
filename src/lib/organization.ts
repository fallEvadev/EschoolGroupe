import "server-only";

import { cache } from "react";

import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type OrganizationSettings = {
  organizationName: string;
  academicYear: string;
  currentSemester: number;
};

/**
 * Paramètres de l'organisation (nom, année, semestre) pour les en-têtes.
 * Lus avec le jeton de l'utilisateur : la RLS s'applique (lecture ouverte à
 * tout utilisateur connecté). Renvoie `null` sans planter si la base n'est
 * pas encore prête. Mis en cache le temps d'une requête.
 */
export const getOrganizationSettings = cache(
  async (): Promise<OrganizationSettings | null> => {
    if (!isSupabaseConfigured()) return null;

    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from("organization_settings")
      .select("organization_name, academic_year, current_semester")
      .maybeSingle();
    if (!data) return null;

    return {
      organizationName: data.organization_name,
      academicYear: data.academic_year,
      currentSemester: data.current_semester,
    };
  },
);
