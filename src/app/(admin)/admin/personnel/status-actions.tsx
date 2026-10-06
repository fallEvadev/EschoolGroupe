"use client";

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
import {
  needsReason,
  STATUS_ACTION_LABELS,
  type StatusAction,
} from "@/lib/staff";

import { changeStaffStatus } from "./actions";

/** Explication affichée dans la fenêtre de confirmation. */
const CONSEQUENCES: Record<StatusAction, string> = {
  deactivate:
    "ne pourra plus se connecter. Son historique est conservé et le compte peut être réactivé à tout moment.",
  reactivate: "pourra de nouveau se connecter à la plateforme.",
  archive:
    "ne pourra plus se connecter et sa fiche sort des listes courantes. Rien n'est supprimé : la fiche peut être réactivée.",
};

/** Désactiver, réactiver ou archiver une fiche (confirmation + motif). */
export function StatusActions({
  profileId,
  fullName,
  actions,
}: {
  profileId: string;
  fullName: string;
  actions: readonly StatusAction[];
}) {
  const [open, setOpen] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(null);
    setReason("");
    setError(null);
  }

  function confirm(action: StatusAction) {
    setError(null);
    startTransition(async () => {
      const result = await changeStaffStatus({ profileId, action, reason });
      if (result.ok) {
        toast.success(result.message);
        close();
      } else {
        // La fenêtre reste ouverte : le message s'affiche sous le motif.
        setError(result.message);
      }
    });
  }

  if (actions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Statut du compte
      </h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            variant={action === "reactivate" ? "outline" : "destructive"}
            onClick={() => setOpen(action)}
          >
            {STATUS_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>

      <AlertDialog
        open={open !== null}
        onOpenChange={(value) => {
          if (!value && !pending) close();
        }}
      >
        <AlertDialogContent>
          {open && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {STATUS_ACTION_LABELS[open]} cette fiche ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {fullName} {CONSEQUENCES[open]}
                </AlertDialogDescription>
              </AlertDialogHeader>

              {needsReason(open) && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="status-reason">Motif (obligatoire)</Label>
                  <Textarea
                    id="status-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    disabled={pending}
                    aria-invalid={!!error}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Fin de contrat, démission, absence prolongée…"
                  />
                </div>
              )}
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant={open === "reactivate" ? "default" : "destructive"}
                  disabled={pending}
                  onClick={(event) => {
                    // Pas de fermeture automatique : on attend la réponse du serveur.
                    event.preventDefault();
                    confirm(open);
                  }}
                >
                  {pending ? "Enregistrement…" : STATUS_ACTION_LABELS[open]}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
