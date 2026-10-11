"use client";

import { FileText } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BilanKind } from "@/lib/bilans";

import { generateBilans } from "./actions";

/**
 * Le bouton « un clic » : génère (ou actualise) les bilans de la période
 * affichée. Le serveur recalcule le début de période et revérifie tout.
 */
export function GenerateButton({
  kind,
  value,
  hasBilans,
}: {
  kind: BilanKind;
  /** Saisie de la période : un jour (semaine) ou « aaaa-mm » (mois). */
  value: string;
  /** Des bilans existent déjà sur cette période : le bouton les actualise. */
  hasBilans: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await generateBilans({ kind, value });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <Button size="lg" disabled={pending} onClick={run}>
      <FileText aria-hidden />
      {pending
        ? "Génération…"
        : hasBilans
          ? "Actualiser les bilans"
          : "Générer les bilans"}
    </Button>
  );
}
