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

import { linkTicketToMachine } from "./actions";

export type MachineChoice = {
  id: string;
  label: string;
  /** La machine a déjà un ticket ouvert : le rattachement fusionne les deux. */
  hasOpenTicket: boolean;
};

/**
 * Rattache un ticket « Autre équipement » à une machine de l'inventaire de
 * l'école. Une confirmation explique ce qui va se passer, surtout en cas de
 * fusion. La base revérifie tout.
 */
export function LinkMachineForm({
  ticketId,
  equipmentLabel,
  machines,
}: {
  ticketId: string;
  equipmentLabel: string;
  machines: MachineChoice[];
}) {
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const machine = machines.find((m) => m.id === selected);

  function confirm() {
    if (!machine) return;
    startTransition(async () => {
      const result = await linkTicketToMachine({
        ticketId,
        machineId: machine.id,
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirming(false);
        setSelected("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Rattacher à une machine
      </h3>
      {machines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune machine active dans le parc de cette école. Ajoutez-la dans «
          Parc informatique », puis revenez rattacher ce ticket.
        </p>
      ) : (
        <>
          <Label htmlFor={`link-${ticketId}`} className="sr-only">
            Machine de l&apos;inventaire
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id={`link-${ticketId}`}
              className={SELECT_CLASS}
              value={selected}
              disabled={pending}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Choisir la machine…</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.hasOpenTicket ? " (ticket ouvert : fusion)" : ""}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={pending || !machine}
              onClick={() => setConfirming(true)}
            >
              Rattacher
            </Button>
          </div>
        </>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={(value) => {
          if (!pending) setConfirming(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {machine?.hasOpenTicket
                ? "Fusionner avec le ticket existant ?"
                : "Rattacher ce ticket ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {machine?.hasOpenTicket
                ? `« ${machine.label} » a déjà un ticket ouvert. Les signalements de « ${equipmentLabel} » rejoignent ce ticket, et celui-ci est archivé (rien n'est supprimé).`
                : `Le ticket « ${equipmentLabel} » devient celui de la machine « ${machine?.label ?? ""} ». Les prochaines pannes de cette machine s'y ajouteront.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                // Pas de fermeture automatique : on attend la réponse du serveur.
                event.preventDefault();
                confirm();
              }}
            >
              {pending
                ? "Enregistrement…"
                : machine?.hasOpenTicket
                  ? "Fusionner"
                  : "Rattacher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
