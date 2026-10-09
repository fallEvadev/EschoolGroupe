import { z } from "zod";

import { MAX_ISSUES } from "@/lib/reports";

const issueSchema = z.object({
  equipment: z
    .string()
    .trim()
    .min(2, "Nommez l'équipement en panne (au moins 2 caractères).")
    .max(80, "Le nom de l'équipement ne doit pas dépasser 80 caractères."),
  description: z
    .string()
    .trim()
    .min(3, "Décrivez la panne (au moins 3 caractères).")
    .max(300, "La description ne doit pas dépasser 300 caractères."),
});

/**
 * Contenu du rapport. Pour un brouillon, les champs texte peuvent rester vides ;
 * c'est `submit: true` qui exige un rapport complet. Le formateur n'est jamais
 * désigné ici : son identité vient du jeton, et l'école, le créneau et la date
 * viennent du pointage.
 */
export const reportSchema = z
  .object({
    attendanceId: z.uuid("Pointage invalide."),
    classes: z
      .string()
      .trim()
      .max(300, "Les classes ne doivent pas dépasser 300 caractères."),
    courseTheme: z
      .string()
      .trim()
      .max(1000, "Le thème ne doit pas dépasser 1000 caractères."),
    equipmentOk: z.boolean({ message: "Indiquez l'état du matériel." }),
    issues: z
      .array(issueSchema)
      .max(MAX_ISSUES, `Au plus ${MAX_ISSUES} pannes par rapport.`),
    submit: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.equipmentOk && value.issues.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["issues"],
        message: "Le matériel est indiqué en bon état : retirez les pannes.",
      });
    }
    if (!value.equipmentOk && value.issues.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["issues"],
        message: "Ajoutez au moins une panne.",
      });
    }
    if (!value.submit) return;
    if (value.classes.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["classes"],
        message: "Indiquez la ou les classes.",
      });
    }
    if (value.courseTheme.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["courseTheme"],
        message: "Indiquez le thème du cours.",
      });
    }
  });

export type ReportInput = z.input<typeof reportSchema>;
export type ReportData = z.output<typeof reportSchema>;

/** Réponse du serveur à l'enregistrement d'un rapport. */
export type ReportResult =
  | { ok: true; message: string; reportId: string; submitted: boolean }
  | { ok: false; message: string };
