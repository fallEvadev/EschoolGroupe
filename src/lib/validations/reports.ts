import { z } from "zod";

import { MAX_ISSUES } from "@/lib/reports";

const issueSchema = z
  .object({
    // Machine de l'inventaire, ou `null`/absent pour « Autre équipement ».
    machineId: z
      .uuid("Machine invalide.")
      .nullish()
      .transform((value) => value ?? null),
    equipment: z
      .string()
      .trim()
      .max(80, "Le nom de l'équipement ne doit pas dépasser 80 caractères."),
    description: z
      .string()
      .trim()
      .min(3, "Décrivez la panne (au moins 3 caractères).")
      .max(300, "La description ne doit pas dépasser 300 caractères."),
  })
  .superRefine((issue, ctx) => {
    // Une machine de l'inventaire a déjà son nom ; sinon le nom libre est requis.
    if (issue.machineId === null && issue.equipment.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["equipment"],
        message: "Nommez l'équipement en panne (au moins 2 caractères).",
      });
    }
  });

/** Vrai si une même machine de l'inventaire est signalée deux fois. */
function hasDuplicateMachine(issues: { machineId: string | null }[]): boolean {
  const ids = issues.flatMap((i) => (i.machineId ? [i.machineId] : []));
  return new Set(ids).size !== ids.length;
}

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
    if (hasDuplicateMachine(value.issues)) {
      ctx.addIssue({
        code: "custom",
        path: ["issues"],
        message: "Une même machine ne peut être signalée qu'une fois.",
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

/** Décisions possibles de la Direction sur un rapport envoyé. */
export const REVIEW_DECISIONS = [
  "valide",
  "valide_avec_corrections",
  "a_modifier",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/**
 * Décision de la Direction. Le commentaire est obligatoire pour « à modifier » ;
 * le contenu corrigé est obligatoire (et complet) pour « validé avec
 * corrections », interdit sinon. Le serveur et la base revérifient tout.
 */
export const reviewReportSchema = z
  .object({
    reportId: z.uuid("Rapport invalide."),
    decision: z.enum(REVIEW_DECISIONS, { message: "Décision invalide." }),
    comment: z
      .string()
      .trim()
      .max(500, "Le commentaire ne doit pas dépasser 500 caractères."),
    corrections: z
      .object({
        classes: z
          .string()
          .trim()
          .min(2, "Indiquez la ou les classes.")
          .max(300, "Les classes ne doivent pas dépasser 300 caractères."),
        courseTheme: z
          .string()
          .trim()
          .min(3, "Indiquez le thème du cours.")
          .max(1000, "Le thème ne doit pas dépasser 1000 caractères."),
        equipmentOk: z.boolean({ message: "Indiquez l'état du matériel." }),
        issues: z
          .array(issueSchema)
          .max(MAX_ISSUES, `Au plus ${MAX_ISSUES} pannes par rapport.`),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "a_modifier" && value.comment.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Expliquez ce que le formateur doit modifier.",
      });
    }
    if (value.decision === "valide_avec_corrections" && !value.corrections) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections"],
        message: "Indiquez les corrections apportées.",
      });
    }
    if (value.decision !== "valide_avec_corrections" && value.corrections) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections"],
        message: "Seule une validation avec corrections modifie le contenu.",
      });
    }
    const c = value.corrections;
    if (c && c.equipmentOk && c.issues.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "issues"],
        message: "Le matériel est indiqué en bon état : retirez les pannes.",
      });
    }
    if (c && !c.equipmentOk && c.issues.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "issues"],
        message: "Ajoutez au moins une panne.",
      });
    }
    if (c && hasDuplicateMachine(c.issues)) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "issues"],
        message: "Une même machine ne peut être signalée qu'une fois.",
      });
    }
  });

export type ReviewReportInput = z.input<typeof reviewReportSchema>;

/** Réponse du serveur à une décision. */
export type ReviewResult = { ok: boolean; message: string };

/** Réponse du serveur à l'enregistrement d'un rapport. */
export type ReportResult =
  | { ok: true; message: string; reportId: string; submitted: boolean }
  | { ok: false; message: string };
