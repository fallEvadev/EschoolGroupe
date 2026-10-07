"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  schoolSchema,
  type SchoolData,
  type SchoolFormValues,
  type SchoolResult,
} from "@/lib/validations/schools";

import { createSchool, updateSchool } from "./actions";

type SchoolFormProps = {
  /** Absent : création. Présent : modification de l'école. */
  schoolId?: string;
  initial: SchoolFormValues;
};

/** Un champ : libellé, contrôle, aide et message d'erreur. */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-muted-foreground text-sm">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Formulaire d'une école (création ou modification). La position GPS n'y figure
 * pas : le directeur partenaire l'enregistre une fois, sur place, depuis son
 * espace. L'administrateur n'a pas à se déplacer.
 */
export function SchoolForm({ schoolId, initial }: SchoolFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<SchoolResult | null>(null);
  const editing = schoolId !== undefined;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SchoolFormValues, unknown, SchoolData>({
    // Même schéma Zod que le serveur, qui revérifie tout.
    resolver: zodResolver(schoolSchema),
    defaultValues: initial,
  });

  async function onSubmit() {
    // Valeurs saisies : le serveur les revérifie et les nettoie lui-même.
    const values = getValues();
    const response = editing
      ? await updateSchool(schoolId, values)
      : await createSchool(values);
    setResult(response);
    if (response.ok && response.id) {
      toast.success(response.message);
      router.push(`/admin/ecoles?ecole=${response.id}`);
    }
  }

  const describedBy = (field: keyof SchoolFormValues) =>
    errors[field] ? `${field}-error` : undefined;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nom de l'école" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="off"
            disabled={isSubmitting}
            aria-invalid={!!errors.name}
            aria-describedby={describedBy("name")}
            {...register("name")}
          />
        </Field>
        <Field
          id="address"
          label="Adresse (facultatif)"
          error={errors.address?.message}
        >
          <Input
            id="address"
            autoComplete="off"
            placeholder="Quartier, ville"
            disabled={isSubmitting}
            aria-invalid={!!errors.address}
            aria-describedby={describedBy("address")}
            {...register("address")}
          />
        </Field>
      </div>

      <div className="max-w-sm">
        <Field
          id="lateToleranceMinutes"
          label="Tolérance de retard (minutes)"
          error={errors.lateToleranceMinutes?.message}
          hint="Au-delà de l'heure de début plus cette durée : retard."
        >
          <Input
            id="lateToleranceMinutes"
            type="number"
            inputMode="numeric"
            min={0}
            max={180}
            disabled={isSubmitting}
            aria-invalid={!!errors.lateToleranceMinutes}
            aria-describedby={describedBy("lateToleranceMinutes")}
            {...register("lateToleranceMinutes", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <p className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">
        <strong>Position de l&apos;école :</strong> vous n&apos;avez rien à
        saisir ici. Une fois l&apos;école créée et son directeur rattaché, le
        directeur enregistre la position depuis son espace, quand il est à
        l&apos;école. Au pointage, la position du téléphone du formateur est
        relevée automatiquement et comparée à celle-ci.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Enregistrement…"
            : editing
              ? "Enregistrer l'école"
              : "Créer l'école"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          Annuler
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={
            result?.ok ? "text-success text-sm" : "text-destructive text-sm"
          }
        >
          {result && !result.ok ? result.message : null}
        </p>
      </div>
    </form>
  );
}
