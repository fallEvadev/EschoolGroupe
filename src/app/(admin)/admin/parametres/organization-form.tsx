"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
} from "@/lib/validations/settings";

import { updateOrganizationSettings } from "./actions";

/** Message d'erreur sous un champ. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}

/** Formulaire des paramètres de l'organisation (Super-Admin). */
export function OrganizationForm({
  initial,
}: {
  initial: OrganizationSettingsInput;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationSettingsInput>({
    // Contrôle côté client avec le même schéma Zod que le serveur.
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: OrganizationSettingsInput) {
    const result = await updateOrganizationSettings(values);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="organizationName">Nom de l&apos;organisation</Label>
        <Input
          id="organizationName"
          disabled={isSubmitting}
          aria-invalid={!!errors.organizationName}
          aria-describedby="organizationName-error"
          {...register("organizationName")}
        />
        <FieldError
          id="organizationName-error"
          message={errors.organizationName?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="academicYear">Année scolaire</Label>
          <Input
            id="academicYear"
            placeholder="2025-2026"
            inputMode="numeric"
            disabled={isSubmitting}
            aria-invalid={!!errors.academicYear}
            aria-describedby="academicYear-error"
            {...register("academicYear")}
          />
          <FieldError
            id="academicYear-error"
            message={errors.academicYear?.message}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="currentSemester">Semestre en cours</Label>
          <select
            id="currentSemester"
            disabled={isSubmitting}
            className="border-input bg-card focus-visible:ring-ring h-11 rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none md:text-sm"
            {...register("currentSemester", { valueAsNumber: true })}
          >
            <option value={1}>Semestre 1</option>
            <option value={2}>Semestre 2</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
