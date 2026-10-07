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

import { setSchoolStatus } from "./actions";

/** Archive ou restaure une école. Aucune suppression : tout reste consultable. */
export function SchoolStatusButton({
  schoolId,
  schoolName,
  archived,
}: {
  schoolId: string;
  schoolName: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await setSchoolStatus({
        schoolId,
        status: archived ? "actif" : "archive",
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        variant={archived ? "outline" : "destructive"}
        onClick={() => setOpen(true)}
      >
        {archived ? "Restaurer" : "Archiver"}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archived ? "Restaurer" : "Archiver"} {schoolName} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archived
                ? "L'école redevient active : ses créneaux et ses codes pourront de nouveau servir."
                : "L'école sort des listes courantes et plus aucun code ne sera généré pour elle. Rien n'est supprimé : vous pourrez la restaurer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant={archived ? "default" : "destructive"}
              disabled={pending}
              onClick={(event) => {
                // Pas de fermeture automatique : on attend la réponse du serveur.
                event.preventDefault();
                confirm();
              }}
            >
              {pending
                ? "Enregistrement…"
                : archived
                  ? "Restaurer l'école"
                  : "Archiver l'école"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
