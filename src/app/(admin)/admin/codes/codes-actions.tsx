"use client";

import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
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

import { generateTodayCodes, regenerateCode } from "./actions";

/** Génère les codes du jour manquants (aucun code existant n'est modifié). */
export function GenerateCodesButton({ missing }: { missing: number }) {
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateTodayCodes();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <Button onClick={generate} disabled={pending}>
      <KeyRound aria-hidden />
      {pending
        ? "Génération…"
        : missing > 0
          ? `Générer les codes du jour (${missing})`
          : "Générer les codes du jour"}
    </Button>
  );
}

/** Copier le code et le régénérer (avec confirmation) pour une école. */
export function CodeActions({
  schoolId,
  schoolName,
  code,
}: {
  schoolId: string;
  schoolName: string;
  /** Code du jour de l'école, ou `null` s'il n'est pas encore généré. */
  code: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Copie bloquée par le navigateur : le code reste visible à l'écran.
      toast.error("Copie impossible : recopiez le code affiché.");
    }
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateCode({ schoolId });
      if (result.ok) {
        toast.success(result.message);
        setConfirming(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {code && (
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copié" : "Copier"}
        </Button>
      )}
      {code && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <RefreshCw aria-hidden />
          Régénérer
        </Button>
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
              Régénérer le code de {schoolName} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le code actuel ne fonctionnera plus. Les formateurs qui l&apos;ont
              reçu devront utiliser le nouveau, à transmettre de nouveau au
              directeur. L&apos;ancien code est conservé en archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                // Pas de fermeture automatique : on attend la réponse du serveur.
                event.preventDefault();
                regenerate();
              }}
            >
              {pending ? "Génération…" : "Régénérer le code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
