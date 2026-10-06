"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireActionRole } from "@/lib/auth/action-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  publishRulesSchema,
  type RulesResult,
} from "@/lib/validations/rules";

const RH_ROLES = ["admin_rh", "super_admin"] as const;

/**
 * Publie une nouvelle version du règlement. Les versions précédentes restent
 * intactes ; chaque personne concernée devra accepter la nouvelle.
 */
export async function publishRules(input: unknown): Promise<RulesResult> {
  const caller = await requireActionRole(RH_ROLES);
  if (!caller.ok) return { ok: false, message: caller.message };

  const parsed = publishRulesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { title, content } = parsed.data;

  try {
    // Client avec le jeton de l'utilisateur : la RLS revérifie le rôle.
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("internal_rules")
      .insert({ title, content, published_by: caller.actorId })
      .select("id, version")
      .single();
    if (error) {
      console.error("internal_rules :", error.message);
      return {
        ok: false,
        message: "Publication impossible. Réessayez dans un instant.",
      };
    }

    await writeAudit({
      actorId: caller.actorId,
      action: "rules_published",
      entity: "internal_rules",
      entityId: data.id,
      details: { version: data.version, title },
    });

    // Tout le personnel concerné doit repasser par la page d'acceptation.
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Version ${data.version} publiée. Le personnel concerné devra l'accepter à sa prochaine visite.`,
    };
  } catch (error) {
    console.error("publishRules :", error);
    return {
      ok: false,
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
}
