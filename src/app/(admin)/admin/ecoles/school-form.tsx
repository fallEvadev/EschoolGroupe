"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed } from "lucide-react";
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

/** Formulaire d'une école (création ou modification). */
export function SchoolForm({ schoolId, initial }: SchoolFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<SchoolResult | null>(null);
  const [locating, setLocating] = useState(false);
  const editing = schoolId !== undefined;

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
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

  /** Relève la position du téléphone : à faire une fois sur place, devant l'école. */
  function fillFromGps() {
    if (!("geolocation" in navigator)) {
      toast.error("Ce navigateur ne permet pas la géolocalisation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const options = { shouldDirty: true, shouldValidate: true };
        setValue("latitude", position.coords.latitude.toFixed(6), options);
        setValue("longitude", position.coords.longitude.toFixed(6), options);
        setLocating(false);
        toast.success(
          `Position relevée (précision d'environ ${Math.round(position.coords.accuracy)} m).`,
        );
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Autorisez la localisation dans le navigateur pour relever la position."
            : "Position indisponible. Réessayez à l'extérieur ou saisissez les coordonnées.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
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

      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-2 text-sm font-semibold">
          Position pour le pointage
        </legend>
        <p className="text-muted-foreground text-sm">
          Sans position, le pointage ne peut pas vérifier que le formateur est
          bien à l&apos;école : ses pointages seront à vérifier.
        </p>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || locating}
            onClick={fillFromGps}
          >
            <LocateFixed aria-hidden />
            {locating ? "Localisation…" : "Utiliser ma position actuelle"}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="latitude"
            label="Latitude"
            error={errors.latitude?.message}
          >
            <Input
              id="latitude"
              inputMode="decimal"
              placeholder="16.032600"
              disabled={isSubmitting}
              aria-invalid={!!errors.latitude}
              aria-describedby={describedBy("latitude")}
              {...register("latitude")}
            />
          </Field>
          <Field
            id="longitude"
            label="Longitude"
            error={errors.longitude?.message}
          >
            <Input
              id="longitude"
              inputMode="decimal"
              placeholder="-16.489600"
              disabled={isSubmitting}
              aria-invalid={!!errors.longitude}
              aria-describedby={describedBy("longitude")}
              {...register("longitude")}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="radiusM"
            label="Rayon autorisé (mètres)"
            error={errors.radiusM?.message}
            hint="Distance maximale entre le formateur et l'école."
          >
            <Input
              id="radiusM"
              type="number"
              inputMode="numeric"
              min={20}
              max={5000}
              disabled={isSubmitting}
              aria-invalid={!!errors.radiusM}
              aria-describedby={describedBy("radiusM")}
              {...register("radiusM", { valueAsNumber: true })}
            />
          </Field>
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
      </fieldset>

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
