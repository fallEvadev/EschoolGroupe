import "server-only";

import { cache } from "react";

import {
  createAdminSupabase,
  isAdminSupabaseConfigured,
} from "@/lib/supabase/admin";

export type OrganizationSettings = {
  organizationName: string;
  academicYear: string;
  currentSemester: number;
};

/**
 * Paramètres de l'organisation (nom, année, semestre) pour les en-têtes.
 * Renvoie `null` sans planter si la base n'est pas encore prête : l'en-tête
 * s'affiche alors sans ces informations. Mis en cache le temps d'une requête.
 */
export const getOrganizationSettings = cache(
  async (): Promise<OrganizationSettings | null> => {
    if (!isAdminSupabaseConfigured()) return null;

    const { data } = await createAdminSupabase()
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
