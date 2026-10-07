"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getProgramUrl } from "@/app/programmes/actions";
import { Button } from "@/components/ui/button";

/** Ouvre le PDF d'un programme dans un nouvel onglet, par un lien signé de 60 secondes. */
export function OpenProgramButton({
  programId,
  label = "Ouvrir le PDF",
  variant = "default",
  size = "default",
}: {
  programId: string;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    // Onglet ouvert tout de suite (sinon le navigateur le bloque).
    const tab = window.open("", "_blank");
    try {
      const response = await getProgramUrl({ programId });
      if (response.ok && tab) {
        tab.opener = null;
        tab.location.href = response.url;
      } else {
        tab?.close();
        toast.error(
          response.ok
            ? "Autorisez l'ouverture des onglets pour voir le programme."
            : response.message,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} disabled={busy} onClick={open}>
      <FileText aria-hidden />
      {busy ? "Ouverture…" : label}
    </Button>
  );
}
