"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Copie un texte dans le presse-papiers, avec un retour « Copié » de 2,5 s. */
export function CopyButton({
  value,
  label = "Copier",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Copie bloquée par le navigateur : le texte reste visible à l'écran.
      toast.error("Copie impossible : recopiez le texte affiché.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copié" : label}
    </Button>
  );
}
