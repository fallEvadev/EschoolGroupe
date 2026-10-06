"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { getCurrentRules, getOwnProfileId } from "@/lib/internal-rules";
import { createServerSupabase } from "@/lib/supabase/server";
import { acceptRulesSchema, type RulesResult } from "@/lib/validations/rules";

/** Code PostgreSQL d'une valeur en double (ici : déjà accepté). */
const UNIQUE_VIOLATION = "23505";

const ERREUR_GENERIQUE: RulesResult = {
  ok: false,
  message: "Une erreur est survenue. Réessayez dans un instant.",
};

/**
 * Enregistre l'acceptation de la version en vigueur par l'utilisateur
 * connecté, et par lui seul : la RLS refuse toute acceptation au nom d'un
 * autre.
 */
export async function acceptRules(input: unknown): Promise<RulesResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Connexion requise." };

  const parsed = acceptRulesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { rulesId } = parsed.data;

  try {
    // Seule la version en vigueur peut être acceptée : si une nouvelle vient
    // d'être publiée, la personne doit d'abord la lire.
    const rules = await getCurrentRules();
    if (!rules || rules.id !== rulesId) {
      return {
        ok: false,
        message:
          "Une nouvelle version du règlement vient d'être publiée. Actualisez la page pour la lire.",
      };
    }

    const profileId = await getOwnProfileId();
    if (!profileId) {
      return {
        ok: false,
        message:
          "Votre fiche est introuvable. Contactez l'administration pour finaliser votre accès.",
      };
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("document_acceptances")
      .insert({ rules_id: rules.id, profile_id: profileId });

    // Déjà accepté (double clic, deux onglets) : le résultat est le même.
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("document_acceptances :", error.message);
      return ERREUR_GENERIQUE;
    }

    if (!error) {
      await writeAudit({
        actorId: userId,
        action: "rules_accepted",
        entity: "internal_rules",
        entityId: rules.id,
        details: { version: rules.version },
      });
    }

    // Le contrôle d'acceptation est dans les layouts : on les rafraîchit tous.
    revalidatePath("/", "layout");
    return { ok: true, message: "Règlement accepté. Merci." };
  } catch (error) {
    console.error("acceptRules :", error);
    return ERREUR_GENERIQUE;
  }
}
