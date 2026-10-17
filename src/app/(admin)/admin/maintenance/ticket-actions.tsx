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
import { SELECT_CLASS } from "@/components/ui/select";
import type { TicketResult } from "@/lib/validations/tickets";

import { archiveTicket, assignTicket } from "./actions";

export type MaintenancierOption = { id: string; name: string };

function notify(result: TicketResult) {
  if (result.ok) toast.success(result.message);
  else toast.error(result.message);
}

/** Affectation et archivage d'un ticket. Le serveur et la base revérifient tout. */
export function TicketActions({
  ticketId,
  equipmentLabel,
  assignedTo,
  maintenanciers,
  assignable,
  archivable,
}: {
  ticketId: string;
  equipmentLabel: string;
  assignedTo: string | null;
  /** Maintenanciers actifs, proposés à l'affectation. */
  maintenanciers: MaintenancierOption[];
  assignable: boolean;
  archivable: boolean;
}) {
  const [selected, setSelected] = useState(assignedTo ?? "");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      notify(await assignTicket({ ticketId, profileId: selected || null }));
    });
  }

  function confirmArchive() {
    startTransition(async () => {
      const result = await archiveTicket({ ticketId });
      notify(result);
      if (result.ok) setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {assignable && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`assign-${ticketId}`}>
            Maintenancier chargé du ticket
          </Label>
          {maintenanciers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun maintenancier actif. L&apos;Admin RH peut créer un compte
              maintenancier dans « Personnel ».
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                id={`assign-${ticketId}`}
                className={SELECT_CLASS}
                value={selected}
                disabled={pending}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Non affecté</option>
                {maintenanciers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <Button
                disabled={pending || selected === (assignedTo ?? "")}
                onClick={save}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          )}
        </div>
      )}

      {archivable && (
        <div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Archiver le ticket
          </Button>
        </div>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={(value) => {
          if (!pending) setConfirming(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver ce ticket ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le ticket « {equipmentLabel} » sort de la liste « À traiter ».
              Rien n&apos;est supprimé : il reste consultable dans « Archivés ».
              Si la machine tombe de nouveau en panne, un nouveau ticket sera
              ouvert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                // Pas de fermeture automatique : on attend la réponse du serveur.
                event.preventDefault();
                confirmArchive();
              }}
            >
              {pending ? "Archivage…" : "Archiver le ticket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
