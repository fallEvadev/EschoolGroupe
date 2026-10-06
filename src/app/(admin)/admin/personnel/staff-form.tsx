"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InvitationShare } from "@/components/invitation-share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { CONTRACT_LABELS, CONTRACT_TYPES } from "@/lib/staff";
import {
  staffSchema,
  type StaffData,
  type StaffFormValues,
  type StaffResult,
} from "@/lib/validations/staff";

import { createStaffMember, updateStaffMember } from "./actions";

const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:text-sm";

type StaffFormProps = {
  /** Absent : création d'une recrue. Présent : modification de la fiche. */
  profileId?: string;
  initial: StaffFormValues;
  /** Rôles que l'utilisateur connecté peut attribuer. */
  roles: readonly Role[];
};

/** Un champ : libellé, contrôle et message d'erreur. */
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

/** Formulaire d'une fiche du personnel (création ou modification). */
export function StaffForm({ profileId, initial, roles }: StaffFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<StaffResult | null>(null);
  const editing = profileId !== undefined;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues, unknown, StaffData>({
    // Même schéma Zod que le serveur, qui revérifie tout.
    resolver: zodResolver(staffSchema),
    defaultValues: initial,
  });

  async function onSubmit() {
    // On envoie les valeurs saisies : le serveur les nettoie lui-même.
    const values = getValues();
    const response = editing
      ? await updateStaffMember(profileId, values)
      : await createStaffMember(values);
    setResult(response);
    // Nouvelle recrue avec lien : on reste ici pour l'envoyer par WhatsApp.
    if (response.share) return;
    // Sinon (modification, ou invitation en échec), on ouvre la fiche.
    if (response.id) router.push(`/admin/personnel?fiche=${response.id}`);
  }

  if (result?.share && result.id) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="text-success mt-0.5 size-6 shrink-0"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{result.message}</p>
            <p className="text-muted-foreground text-sm">
              Envoyez aussi le lien par WhatsApp : la personne choisira son mot
              de passe en l&apos;ouvrant.
            </p>
          </div>
        </div>
        <InvitationShare share={result.share} />
        <div className="border-t pt-4">
          <Button variant="outline" asChild>
            <Link href={`/admin/personnel?fiche=${result.id}`}>
              Ouvrir la fiche
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const describedBy = (field: keyof StaffFormValues) =>
    errors[field] ? `${field}-error` : undefined;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Prénom" error={errors.firstName?.message}>
          <Input
            id="firstName"
            autoComplete="off"
            disabled={isSubmitting}
            aria-invalid={!!errors.firstName}
            aria-describedby={describedBy("firstName")}
            {...register("firstName")}
          />
        </Field>
        <Field id="lastName" label="Nom" error={errors.lastName?.message}>
          <Input
            id="lastName"
            autoComplete="off"
            disabled={isSubmitting}
            aria-invalid={!!errors.lastName}
            aria-describedby={describedBy("lastName")}
            {...register("lastName")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="email"
          label="Adresse e-mail"
          error={errors.email?.message}
          hint={
            editing
              ? "Identifiant de connexion : il ne peut pas être modifié."
              : "L'invitation sera envoyée à cette adresse."
          }
        >
          <Input
            id="email"
            type="email"
            autoComplete="off"
            readOnly={editing}
            disabled={isSubmitting}
            aria-invalid={!!errors.email}
            aria-describedby={describedBy("email")}
            {...register("email")}
          />
        </Field>
        <Field
          id="phone"
          label="Téléphone (facultatif)"
          error={errors.phone?.message}
        >
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="77 123 45 67"
            disabled={isSubmitting}
            aria-invalid={!!errors.phone}
            aria-describedby={describedBy("phone")}
            {...register("phone")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="role" label="Rôle" error={errors.role?.message}>
          <select
            id="role"
            disabled={isSubmitting}
            className={SELECT_CLASS}
            {...register("role")}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="jobTitle"
          label="Spécialité (facultatif)"
          error={errors.jobTitle?.message}
        >
          <Input
            id="jobTitle"
            placeholder="Développement web"
            disabled={isSubmitting}
            aria-invalid={!!errors.jobTitle}
            aria-describedby={describedBy("jobTitle")}
            {...register("jobTitle")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="contractType"
          label="Type de contrat (facultatif)"
          error={errors.contractType?.message}
        >
          <select
            id="contractType"
            disabled={isSubmitting}
            className={SELECT_CLASS}
            {...register("contractType")}
          >
            <option value="">Non renseigné</option>
            {CONTRACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONTRACT_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="hireDate"
          label="Date d'arrivée (facultatif)"
          error={errors.hireDate?.message}
        >
          <Input
            id="hireDate"
            type="date"
            disabled={isSubmitting}
            aria-invalid={!!errors.hireDate}
            aria-describedby={describedBy("hireDate")}
            {...register("hireDate")}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Enregistrement…"
            : editing
              ? "Enregistrer la fiche"
              : "Créer et envoyer l'invitation"}
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
          {result?.message}
        </p>
      </div>
    </form>
  );
}
