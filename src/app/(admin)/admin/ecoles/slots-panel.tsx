"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatSlot,
  formatTime,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from "@/lib/schools";
import {
  slotSchema,
  type SlotData,
  type SlotFormValues,
  type SchoolResult,
} from "@/lib/validations/schools";

import {
  addSlot,
  archiveSlot,
  assignFormateur,
  unassignFormateur,
} from "./actions";
import type { PersonOption } from "./directors-panel";

export type SlotView = {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  label: string | null;
  assignments: { id: string; profileId: string; name: string }[];
};

const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:text-sm";

function notify(result: SchoolResult) {
  if (result.ok) toast.success(result.message);
  else toast.error(result.message);
}

/** Créneaux hebdomadaires de l'école et formateurs affectés à chacun. */
export function SlotsPanel({
  schoolId,
  slots,
  formateurs,
  disabled,
}: {
  schoolId: string;
  slots: SlotView[];
  /** Formateurs actifs, proposés à l'affectation. */
  formateurs: PersonOption[];
  /** École archivée : plus de modification. */
  disabled: boolean;
}) {
  const byDay = WEEKDAYS.map((day) => ({
    day,
    slots: slots
      .filter((slot) => slot.weekday === day)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  })).filter((group) => group.slots.length > 0);

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Créneaux et formateurs
      </h3>

      {byDay.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun créneau. Ajoutez les plages horaires où des formateurs
          interviennent dans cette école.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {byDay.map((group) => (
            <div key={group.day} className="flex flex-col gap-2">
              <h4 className="font-semibold">{WEEKDAY_LABELS[group.day]}</h4>
              <ul className="divide-border divide-y rounded-xl border">
                {group.slots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    formateurs={formateurs}
                    disabled={disabled}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!disabled && <AddSlotForm schoolId={schoolId} />}
    </section>
  );
}

function SlotRow({
  slot,
  formateurs,
  disabled,
}: {
  slot: SlotView;
  formateurs: PersonOption[];
  disabled: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [pending, startTransition] = useTransition();

  const assignedIds = new Set(slot.assignments.map((a) => a.profileId));
  // Formateurs pas encore sur ce créneau (le serveur contrôle aussi les doubles).
  const available = formateurs.filter((person) => !assignedIds.has(person.id));

  function assign() {
    if (!selected) return;
    startTransition(async () => {
      const result = await assignFormateur({
        slotId: slot.id,
        profileId: selected,
      });
      notify(result);
      if (result.ok) setSelected("");
    });
  }

  function unassign(assignmentId: string) {
    startTransition(async () => {
      notify(await unassignFormateur({ assignmentId }));
    });
  }

  function confirmArchive() {
    startTransition(async () => {
      const result = await archiveSlot({ slotId: slot.id });
      notify(result);
      if (result.ok) setArchiving(false);
    });
  }

  return (
    <li className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium tabular-nums">
          {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
          {slot.label && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {slot.label}
            </span>
          )}
        </p>
        {!disabled && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setArchiving(true)}
          >
            Archiver le créneau
          </Button>
        )}
      </div>

      {slot.assignments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun formateur affecté : personne ne pourra pointer sur ce créneau.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {slot.assignments.map((assignment) => (
            <li key={assignment.id}>
              <Badge className="gap-1">
                {assignment.name}
                {!disabled && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => unassign(assignment.id)}
                    aria-label={`Retirer ${assignment.name} du créneau`}
                    className="hover:text-destructive -mr-1 rounded-full p-0.5 disabled:opacity-50"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {!disabled && available.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`assign-${slot.id}`}>Affecter un formateur</Label>
            <select
              id={`assign-${slot.id}`}
              value={selected}
              disabled={pending}
              onChange={(event) => setSelected(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Choisir…</option>
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={assign} disabled={!selected || pending}>
            <UserPlus aria-hidden />
            Affecter
          </Button>
        </div>
      )}

      <AlertDialog
        open={archiving}
        onOpenChange={(value) => {
          if (!pending) setArchiving(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver ce créneau ?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatSlot({
                weekday: slot.weekday,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                label: slot.label,
              })}
              . Les formateurs affectés n&apos;y seront plus rattachés. Rien
              n&apos;est supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmArchive();
              }}
            >
              {pending ? "Enregistrement…" : "Archiver le créneau"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Formulaire d'ajout d'un créneau (jour, heures, libellé facultatif). */
function AddSlotForm({ schoolId }: { schoolId: string }) {
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SlotFormValues, unknown, SlotData>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      schoolId,
      weekday: 1,
      startsAt: "08:00",
      endsAt: "10:00",
      label: "",
    },
  });

  async function onSubmit() {
    const result = await addSlot(getValues());
    notify(result);
    if (result.ok) reset({ ...getValues(), label: "" });
  }

  const dayError = errors.weekday?.message;
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-xl border p-4"
      noValidate
    >
      <h4 className="font-semibold">Ajouter un créneau</h4>
      <input type="hidden" {...register("schoolId")} />
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="slot-weekday">Jour</Label>
          <select
            id="slot-weekday"
            disabled={isSubmitting}
            className={SELECT_CLASS}
            {...register("weekday", { valueAsNumber: true })}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day]}
              </option>
            ))}
          </select>
          {dayError && <p className="text-destructive text-sm">{dayError}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="slot-start">Début</Label>
          <Input
            id="slot-start"
            type="time"
            disabled={isSubmitting}
            aria-invalid={!!errors.startsAt}
            {...register("startsAt")}
          />
          {errors.startsAt && (
            <p className="text-destructive text-sm">
              {errors.startsAt.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="slot-end">Fin</Label>
          <Input
            id="slot-end"
            type="time"
            disabled={isSubmitting}
            aria-invalid={!!errors.endsAt}
            {...register("endsAt")}
          />
          {errors.endsAt && (
            <p className="text-destructive text-sm">{errors.endsAt.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="slot-label">Libellé (facultatif)</Label>
          <Input
            id="slot-label"
            placeholder="Matin"
            disabled={isSubmitting}
            aria-invalid={!!errors.label}
            {...register("label")}
          />
          {errors.label && (
            <p className="text-destructive text-sm">{errors.label.message}</p>
          )}
        </div>
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          <CalendarPlus aria-hidden />
          {isSubmitting ? "Ajout…" : "Ajouter le créneau"}
        </Button>
      </div>
    </form>
  );
}
