"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InvitationShare } from "@/components/invitation-share";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import {
  grantAccessSchema,
  type GrantAccessData,
  type GrantAccessValues,
  type StaffResult,
} from "@/lib/validations/staff";

import { grantAccess } from "./actions";

const EMPTY: GrantAccessValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "formateur",
};

/** Message d'erreur sous un champ. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}

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
        <Button onClick={() => setOpen(true)}>
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
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
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
        </div>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="grant-firstName">Prénom</Label>
            <Input
              id="grant-firstName"
              autoComplete="off"
              disabled={isSubmitting}
              aria-invalid={!!errors.firstName}
              aria-describedby="grant-firstName-error"
              {...register("firstName")}
            />
            <FieldError
              id="grant-firstName-error"
              message={errors.firstName?.message}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grant-lastName">Nom</Label>
            <Input
              id="grant-lastName"
              autoComplete="off"
              disabled={isSubmitting}
              aria-invalid={!!errors.lastName}
              aria-describedby="grant-lastName-error"
              {...register("lastName")}
            />
            <FieldError
              id="grant-lastName-error"
              message={errors.lastName?.message}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="grant-email">Adresse e-mail</Label>
            <Input
              id="grant-email"
              type="email"
              autoComplete="off"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby="grant-email-error"
              {...register("email")}
            />
            <FieldError
              id="grant-email-error"
              message={errors.email?.message}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grant-phone">Numéro WhatsApp (facultatif)</Label>
            <Input
              id="grant-phone"
              type="tel"
              inputMode="tel"
              placeholder="77 123 45 67"
              disabled={isSubmitting}
              aria-invalid={!!errors.phone}
              aria-describedby="grant-phone-error"
              {...register("phone")}
            />
            <FieldError
              id="grant-phone-error"
              message={errors.phone?.message}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:max-w-xs">
          <Label htmlFor="grant-role">Rôle</Label>
          <select
            id="grant-role"
            disabled={isSubmitting}
            className="border-input bg-card focus-visible:ring-ring h-11 rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none md:text-sm"
            {...register("role")}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          {result && !result.ok && (
            <p role="status" className="text-destructive text-sm">
              {result.message}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
