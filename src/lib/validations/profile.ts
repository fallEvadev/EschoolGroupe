import { z } from "zod";

import { phoneSchema } from "@/lib/validations/staff";

/** Changement de son propre numéro de téléphone (vide = effacer). */
export const myPhoneSchema = z.object({ phone: phoneSchema });

export type ProfileResult =
  { ok: true; message: string } | { ok: false; message: string };
