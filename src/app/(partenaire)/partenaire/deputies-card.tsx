"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserMinus, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormActions } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import {
  deputyInviteSchema,
  MAX_DEPUTIES_PER_SCHOOL,
  type DeputyInviteData,
  type DeputyInviteFormValues,
} from "@/lib/validations/deputies";

import { inviteDeputy, removeDeputy } from "./actions";

export type DeputyView = {
  profileId: string;
  fullName: string;
  /** Statut de la fiche : « invite » tant que le compte n'est pas activé. */
  status: string;
};

/**
 * Adjoints de l'école : ils voient le code et les bilans quand le directeur est
 * absent. Seul le directeur invite ou retire (la base le contrôle aussi).
 */
export function DeputiesCard({
  schoolId,
  deputies,
}: {
  schoolId: string;
  deputies: DeputyView[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const full = deputies.length >= MAX_DEPUTIES_PER_SCHOOL;

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeputyInviteFormValues, unknown, DeputyInviteData>({
    resolver: zodResolver(deputyInviteSchema),
    defaultValues: { schoolId, fullName: "", email: "", phone: "" },
  });

  async function onSubmit() {
    const result = await inviteDeputy(getValues());
    notify(result);
    if (result.ok) {
      reset({ schoolId, fullName: "", email: "", phone: "" });
      setOpen(false);
    }
  }

  function remove(profileId: string) {
    startTransition(async () => {
      notify(await removeDeputy({ schoolId, profileId }));
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Mes adjoints
      </h3>
      <p className="text-muted-foreground text-sm">
        Un adjoint voit le code de descente à votre place quand vous êtes
        absent. Vous pouvez en inviter {MAX_DEPUTIES_PER_SCHOOL} au maximum.
      </p>

      {deputies.length > 0 && (
        <ul className="flex flex-col gap-2">
          {deputies.map((deputy) => (
            <li
              key={deputy.profileId}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{deputy.fullName}</span>
                {deputy.status === "invite" && (
                  <Badge variant="warning">Invitation en attente</Badge>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => remove(deputy.profileId)}
                aria-label={`Retirer ${deputy.fullName}`}
              >
                <UserMinus aria-hidden />
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!open && (
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => setOpen(true)}
          >
            <UserPlus aria-hidden />
            Inviter un adjoint
          </Button>
          {full && (
            <p className="text-muted-foreground mt-2 text-xs">
              Limite atteinte : retirez un adjoint pour en inviter un autre.
            </p>
          )}
        </div>
      )}

      {open && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" {...register("schoolId")} />
          <Field
            id={`deputy-name-${schoolId}`}
            label="Nom complet"
            error={errors.fullName?.message}
          >
            <Input
              autoComplete="off"
              placeholder="Ex. : Adja Sow"
              disabled={isSubmitting}
              {...register("fullName")}
            />
          </Field>
          <Field
            id={`deputy-email-${schoolId}`}
            label="Adresse e-mail"
            error={errors.email?.message}
            hint="L'invitation est envoyée à cette adresse."
          >
            <Input
              type="email"
              autoComplete="off"
              disabled={isSubmitting}
              {...register("email")}
            />
          </Field>
          <Field
            id={`deputy-phone-${schoolId}`}
            label="Téléphone (facultatif)"
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
          <FormActions>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Envoi…" : "Envoyer l'invitation"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
          </FormActions>
        </form>
      )}
    </div>
  );
}
