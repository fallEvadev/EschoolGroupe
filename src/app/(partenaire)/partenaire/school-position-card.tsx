"use client";

import { CheckCircle2, MapPin, TriangleAlert } from "lucide-react";
import { useState } from "react";
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
import { checkSchoolPosition } from "@/lib/attendance";
import { getDevicePosition } from "@/lib/geolocation";

import { setSchoolPosition } from "./actions";

export type SchoolPositionInfo = {
  /** La position de l'école est-elle déjà enregistrée ? */
  defined: boolean;
  /** Date d'enregistrement déjà formatée (jj/mm/aaaa), ou `null`. */
  setOn: string | null;
  /** Qui l'a enregistrée, déjà en toutes lettres, ou `null`. */
  setBy: string | null;
};

/**
 * Le directeur enregistre la position de son école depuis son téléphone, quand
 * il est sur place. À faire une seule fois : l'administrateur n'a pas à se
 * déplacer.
 */
export function SchoolPositionCard({
  schoolId,
  schoolName,
  position,
}: {
  schoolId: string;
  schoolName: string;
  position: SchoolPositionInfo;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setError(null);
    setBusy(true);
    try {
      // Position fraîche du téléphone ; la précision est contrôlée avant l'envoi.
      const device = await getDevicePosition(20_000);
      const checked = checkSchoolPosition(device);
      if (!checked.ok) {
        setError(checked.message);
        return;
      }
      const result = await setSchoolPosition({
        schoolId,
        latitude: checked.latitude,
        longitude: checked.longitude,
        accuracyM: checked.accuracyM,
      });
      if (result.ok) {
        toast.success(result.message);
        setConfirming(false);
      } else {
        setError(result.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Position de l&apos;école
      </h3>

      {position.defined ? (
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2
            className="text-success mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <span>
            Position enregistrée
            {position.setOn ? ` le ${position.setOn}` : ""}
            {position.setBy ? ` (${position.setBy})` : ""}.
          </span>
        </p>
      ) : (
        <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-lg p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            La position de l&apos;école n&apos;est pas encore enregistrée : les
            pointages des formateurs seront à vérifier par la Direction.
          </span>
        </p>
      )}

      <div>
        <Button
          variant={position.defined ? "outline" : "default"}
          disabled={busy}
          onClick={() => (position.defined ? setConfirming(true) : record())}
        >
          <MapPin aria-hidden />
          {busy
            ? "Localisation en cours…"
            : position.defined
              ? "Mettre à jour la position"
              : "📍 Enregistrer la position de l'école"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        À faire une seule fois, quand vous êtes à l&apos;école, de préférence à
        l&apos;extérieur. Autorisez la localisation quand le téléphone le
        demande.
      </p>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={(value) => {
          if (!busy) setConfirming(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remplacer la position de {schoolName} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirmez uniquement si vous êtes <strong>à l&apos;école</strong>{" "}
              en ce moment. La position actuelle de votre téléphone remplacera
              l&apos;ancienne : tous les pointages y seront comparés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                // Pas de fermeture automatique : on attend la réponse du serveur.
                event.preventDefault();
                void record();
              }}
            >
              {busy ? "Localisation en cours…" : "Je suis à l'école"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
