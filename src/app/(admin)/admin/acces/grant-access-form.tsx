"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InvitationShare } from "@/components/invitation-share";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormActions, FormStatus } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import {
  grantAccessSchema,
  type GrantAccessData,
  type GrantAccessValues,
  type StaffResult,
} from "@/lib/validations/staff";

import { grantAccess } from "./actions";

const EMPTY: GrantAccessValues = {
  fullName: "",
  email: "",
  phone: "",
  role: "formateur",
};

/**
 * « Donner un accès » : crée la fiche, envoie l'invitation par e-mail,
 * puis propose de l'envoyer aussi par WhatsApp.
 */
export function GrantAccessForm() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<StaffResult | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GrantAccessValues, unknown, GrantAccessData>({
    resolver: zodResolver(grantAccessSchema),
    defaultValues: EMPTY,
  });

  async function onSubmit() {
    // Valeurs saisies : le serveur les revérifie et les nettoie lui-même.
    setResult(await grantAccess(getValues()));
  }

  function restart() {
    reset(EMPTY);
    setResult(null);
  }

  if (!open) {
    return (
      <div>
        <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          <UserPlus aria-hidden />
          Donner un accès
        </Button>
      </div>
    );
  }

  // Accès créé : partage du lien.
  if (result?.ok) {
    return (
      <Card className="flex flex-col gap-4 p-4 sm:p-6">
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
        {result.share ? (
          <InvitationShare share={result.share} />
        ) : (
          <p className="text-warning text-sm">
            Clerk n&apos;a pas fourni de lien à partager : seule
            l&apos;invitation par e-mail a été envoyée.
          </p>
        )}
        <FormActions className="border-t pt-4">
          <Button variant="outline" onClick={restart}>
            Donner un autre accès
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              restart();
              setOpen(false);
            }}
          >
            Fermer
          </Button>
        </FormActions>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <h2 className="text-lg font-semibold">Donner un accès</h2>
          <p className="text-muted-foreground text-sm">
            La personne reçoit une invitation par e-mail, et vous pourrez lui
            envoyer le lien par WhatsApp.
          </p>
        </div>

        <Field
          id="grant-fullName"
          label="Nom complet"
          error={errors.fullName?.message}
          hint="Prénom(s) puis nom : le dernier mot est le nom de famille."
        >
          <Input
            autoComplete="off"
            placeholder="Ex. : Awa Fall"
            disabled={isSubmitting}
            {...register("fullName")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="grant-email"
            label="Adresse e-mail"
            error={errors.email?.message}
          >
            <Input
              type="email"
              autoComplete="off"
              disabled={isSubmitting}
              {...register("email")}
            />
          </Field>
          <Field
            id="grant-phone"
            label="Numéro WhatsApp (facultatif)"
            error={errors.phone?.message}
          >
            <Input
              type="tel"
              inputMode="tel"
              placeholder="77 123 45 67"
              disabled={isSubmitting}
              {...register("phone")}
            />
          </Field>
        </div>

        <Field id="grant-role" label="Rôle" className="sm:max-w-xs">
          <Select disabled={isSubmitting} {...register("role")}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>

        <FormStatus ok={false}>
          {result && !result.ok ? result.message : null}
        </FormStatus>

        <FormActions>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer l'accès et envoyer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => {
              restart();
              setOpen(false);
            }}
          >
            Annuler
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}
