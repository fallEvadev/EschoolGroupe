"use client";

import { Check, CalendarOff, X } from "lucide-react";
import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates";
import type { FollowUpResult } from "@/lib/validations/attendance-follow-up";

import {
  cancelExcuse,
  closeDay,
  excuseAbsence,
  reopenDay,
  reviewAttendance,
} from "./actions";

const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:text-sm";

function notify(result: FollowUpResult) {
  if (result.ok) toast.success(result.message);
  else toast.error(result.message);
}

/**
 * Fenêtre avec un motif obligatoire. Elle reste ouverte tant que le serveur
 * refuse, et affiche son message sous la saisie.
 */
function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Renvoie le résultat du serveur ; la fenêtre se ferme si `ok`. */
  onConfirm: (reason: string) => Promise<FollowUpResult>;
  /** Champs supplémentaires affichés avant le motif. */
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    onOpenChange(false);
    setReason("");
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm(reason);
      if (result.ok) {
        toast.success(result.message);
        close();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) close();
        else onOpenChange(value);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason-field">{label}</Label>
          <Textarea
            id="reason-field"
            rows={3}
            maxLength={500}
            value={reason}
            disabled={pending}
            aria-invalid={!!error}
            placeholder={placeholder}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={(event) => {
              // Pas de fermeture automatique : on attend la réponse du serveur.
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? "Enregistrement…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Valider ou refuser un pointage « à vérifier » (le refus exige un motif). */
export function ReviewActions({
  attendanceId,
  formateurName,
  decided,
}: {
  attendanceId: string;
  formateurName: string;
  /** Une décision existe déjà : les boutons permettent de la modifier. */
  decided: boolean;
}) {
  const [refusing, setRefusing] = useState(false);
  const [pending, startTransition] = useTransition();

  function validate() {
    startTransition(async () => {
      notify(
        await reviewAttendance({
          attendanceId,
          decision: "valide",
          comment: "",
        }),
      );
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={validate}>
        <Check aria-hidden />
        {decided ? "Valider à la place" : "Valider"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setRefusing(true)}
      >
        <X aria-hidden />
        {decided ? "Refuser à la place" : "Refuser"}
      </Button>
      <ReasonDialog
        open={refusing}
        onOpenChange={setRefusing}
        title={`Refuser le pointage de ${formateurName} ?`}
        description="Le pointage compte alors comme une absence. Le formateur voit le motif sur son accueil."
        label="Motif du refus (obligatoire)"
        placeholder="Absent de l'école, position incohérente…"
        confirmLabel="Refuser le pointage"
        destructive
        onConfirm={(reason) =>
          reviewAttendance({
            attendanceId,
            decision: "refuse",
            comment: reason,
          })
        }
      />
    </div>
  );
}

/** Excuser une absence avec un motif. */
export function ExcuseAction({
  profileId,
  slotId,
  date,
  formateurName,
}: {
  profileId: string;
  slotId: string;
  date: string;
  formateurName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Excuser
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Excuser l'absence de ${formateurName} ?`}
        description="L'absence est comptée à part, comme « excusée ». Le motif reste consultable."
        label="Motif (obligatoire)"
        placeholder="Malade, certificat médical, mission pour l'école…"
        confirmLabel="Excuser l'absence"
        onConfirm={(reason) =>
          excuseAbsence({ profileId, slotId, date, reason })
        }
      />
    </>
  );
}

/** Annule une excuse : l'absence redevient comptée. */
export function CancelExcuseButton({ excuseId }: { excuseId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          notify(await cancelExcuse({ excuseId }));
        })
      }
    >
      Annuler l&apos;excuse
    </Button>
  );
}

export type ClosedDayView = {
  id: string;
  /** Nom de l'école, ou `null` pour toutes les écoles. */
  schoolName: string | null;
  reason: string;
};

/** Jours sans cours : liste des fermetures du jour, et bouton pour en ajouter. */
export function ClosedDayControl({
  date,
  schools,
  closedDays,
}: {
  date: string;
  schools: { id: string; name: string }[];
  closedDays: ClosedDayView[];
}) {
  const [open, setOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {closedDays.map((closed) => (
        <div
          key={closed.id}
          className="bg-muted flex flex-wrap items-center justify-between gap-2 rounded-xl p-3"
        >
          <p className="text-sm">
            <span className="font-semibold">
              Jour sans cours · {closed.schoolName ?? "toutes les écoles"}
            </span>{" "}
            : {closed.reason}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                notify(await reopenDay({ closedDayId: closed.id }));
              })
            }
          >
            Rouvrir
          </Button>
        </div>
      ))}

      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <CalendarOff aria-hidden />
          Marquer ce jour sans cours
        </Button>
      </div>

      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Marquer le ${formatDate(date)} sans cours ?`}
        description="Aucune absence n'est comptée ce jour-là pour les écoles concernées. Les pointages déjà faits restent visibles."
        label="Motif (obligatoire)"
        placeholder="Tabaski, vacances scolaires, grève…"
        confirmLabel="Marquer sans cours"
        onConfirm={(reason) =>
          closeDay({ date, schoolId: schoolId || null, reason })
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="closed-school">École concernée</Label>
          <select
            id="closed-school"
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Toutes les écoles</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>
      </ReasonDialog>
    </div>
  );
}
