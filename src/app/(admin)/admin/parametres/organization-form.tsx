"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormActions } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
} from "@/lib/validations/settings";

import { updateOrganizationSettings } from "./actions";

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
      <Field
        id="organizationName"
        label="Nom de l'organisation"
        error={errors.organizationName?.message}
      >
        <Input disabled={isSubmitting} {...register("organizationName")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="academicYear"
          label="Année scolaire"
          error={errors.academicYear?.message}
        >
          <Input
            placeholder="2025-2026"
            inputMode="numeric"
            disabled={isSubmitting}
            {...register("academicYear")}
          />
        </Field>

        <Field id="currentSemester" label="Semestre en cours">
          <Select
            disabled={isSubmitting}
            {...register("currentSemester", { valueAsNumber: true })}
          >
            <option value={1}>Semestre 1</option>
            <option value={2}>Semestre 2</option>
          </Select>
        </Field>
      </div>

      <FormActions>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </FormActions>
    </form>
  );
}
