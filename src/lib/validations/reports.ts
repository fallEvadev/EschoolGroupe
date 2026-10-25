import { z } from "zod";

import {
  MAX_COURSES,
  MAX_HEADCOUNT,
  MAX_ISSUES,
  missingInCourses,
  TIME_FORMAT,
} from "@/lib/reports";

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

/**
 * Un cours. Pour un brouillon, tout peut rester vide : c'est `missingInCourses`
 * (appelée à l'envoi) qui exige un cours complet. Une heure saisie doit déjà
 * être valide.
 */
const courseSchema = z.object({
  startsAt: z
    .string()
    .trim()
    .refine((v) => v === "" || TIME_FORMAT.test(v), "Heure de début invalide."),
  endsAt: z
    .string()
    .trim()
    .refine((v) => v === "" || TIME_FORMAT.test(v), "Heure de fin invalide."),
  classes: z
    .string()
    .trim()
    .max(100, "Le nom d'une classe ne doit pas dépasser 100 caractères."),
  theme: z
    .string()
    .trim()
    .max(500, "Le thème d'un cours ne doit pas dépasser 500 caractères."),
  headcount: z
    .number({ message: "L'effectif doit être un nombre." })
    .int("L'effectif doit être un nombre entier.")
    .min(0, "L'effectif ne peut pas être négatif.")
    .max(MAX_HEADCOUNT, `L'effectif ne peut pas dépasser ${MAX_HEADCOUNT}.`)
    .nullable(),
});

const coursesSchema = z
  .array(courseSchema)
  .min(1, "Ajoutez au moins un cours.")
  .max(MAX_COURSES, `Au plus ${MAX_COURSES} cours par rapport.`);

/** Vrai si un même matériel (hors inventaire) est signalé deux fois. */
function hasDuplicateEquipment(
  issues: { machineId: string | null; equipment: string }[],
): boolean {
  const names = issues
    .filter((i) => i.machineId === null)
    .map((i) => i.equipment.toLowerCase());
  return new Set(names).size !== names.length;
}

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
    courses: coursesSchema,
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
        message: "Tout fonctionne est indiqué : retirez les difficultés.",
      });
    }
    if (!value.equipmentOk && value.issues.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["issues"],
        message: "Ajoutez au moins une difficulté.",
      });
    }
    if (hasDuplicateMachine(value.issues)) {
      ctx.addIssue({
        code: "custom",
        path: ["issues"],
        message: "Une même machine ne peut être signalée qu'une fois.",
      });
    }
    if (hasDuplicateEquipment(value.issues)) {
      ctx.addIssue({
        code: "custom",
        path: ["issues"],
        message:
          "Ce matériel est signalé deux fois : regroupez-le en une seule difficulté.",
      });
    }
    if (!value.submit) return;
    const missing = missingInCourses(value.courses);
    if (missing) {
      ctx.addIssue({ code: "custom", path: ["courses"], message: missing });
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
        courses: coursesSchema,
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
    const missingCourse = c ? missingInCourses(c.courses) : null;
    if (missingCourse) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "courses"],
        message: missingCourse,
      });
    }
    if (c && c.equipmentOk && c.issues.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "issues"],
        message: "Tout fonctionne est indiqué : retirez les difficultés.",
      });
    }
    if (c && !c.equipmentOk && c.issues.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "issues"],
        message: "Ajoutez au moins une difficulté.",
      });
    }
    if (c && hasDuplicateEquipment(c.issues)) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections", "issues"],
        message:
          "Ce matériel est signalé deux fois : regroupez-le en une seule difficulté.",
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
