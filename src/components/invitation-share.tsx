"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ShareInfo } from "@/lib/validations/staff";

/**
 * Partage du lien d'activation : WhatsApp (message déjà rédigé) ou copie
 * du lien pour l'envoyer par un autre moyen.
 */
export function InvitationShare({ share }: { share: ShareInfo }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Copie bloquée par le navigateur : le lien reste sélectionnable.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="whatsapp" asChild>
          <a href={share.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            Envoyer par WhatsApp
          </a>
        </Button>
        <Button variant="outline" type="button" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Lien copié" : "Copier le lien"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs break-all">
        Lien d&apos;activation pour {share.recipient} :{" "}
        <span className="select-all">{share.url}</span>
      </p>
    </div>
  );
}
