import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";

/** Changement de rôle d'un compte. */
export const updateRoleSchema = z.object({
  userId: z.string().min(1, "Compte manquant."),
  role: z.enum(ROLES, { message: "Rôle invalide." }),
});

/** Activation ou désactivation d'un compte. */
export const setActiveSchema = z.object({
  userId: z.string().min(1, "Compte manquant."),
  active: z.boolean(),
});

export type AccessResult = { ok: boolean; message: string };
