"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
  type SettingsResult,
} from "@/lib/validations/settings";

import { updateOrganizationSettings } from "./actions";

/** Formulaire des paramètres de l'organisation (Super-Admin). */
export function OrganizationForm({
  initial,
}: {
  initial: OrganizationSettingsInput;
}) {
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof OrganizationSettingsInput>(
    key: K,
    value: OrganizationSettingsInput[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Contrôle côté client (le serveur revérifie de toute façon).
    const parsed = organizationSettingsSchema.safeParse(values);
    if (!parsed.success) {
      setResult({
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Données invalides.",
      });
      return;
    }
    startTransition(async () => {
      setResult(await updateOrganizationSettings(parsed.data));
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="organizationName">Nom de l&apos;organisation</Label>
        <Input
          id="organizationName"
          value={values.organizationName}
          onChange={(event) => update("organizationName", event.target.value)}
          disabled={pending}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="academicYear">Année scolaire</Label>
          <Input
            id="academicYear"
            value={values.academicYear}
            onChange={(event) => update("academicYear", event.target.value)}
            placeholder="2025-2026"
            inputMode="numeric"
            disabled={pending}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="currentSemester">Semestre en cours</Label>
          <select
            id="currentSemester"
            value={String(values.currentSemester)}
            onChange={(event) =>
              update("currentSemester", Number(event.target.value))
            }
            disabled={pending}
            className="border-input bg-card focus-visible:ring-ring h-11 rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none md:text-sm"
          >
            <option value="1">Semestre 1</option>
            <option value="2">Semestre 2</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={
            result?.ok ? "text-success text-sm" : "text-destructive text-sm"
          }
        >
          {result?.message}
        </p>
      </div>
    </form>
  );
}
