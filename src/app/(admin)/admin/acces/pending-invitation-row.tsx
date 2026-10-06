"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";

import { InvitationShare } from "@/components/invitation-share";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { StaffResult } from "@/lib/validations/staff";

import { resendAccess } from "./actions";

export type PendingInvitation = {
  profileId: string;
  name: string;
  email: string;
  role: Role;
  /** Date d'envoi déjà formatée côté serveur, ou `null` si jamais envoyée. */
  invitedAt: string | null;
};

/**
 * Personne invitée qui n'a pas encore activé son compte. « Renvoyer » crée
 * un nouveau lien (e-mail) et propose de le partager par WhatsApp.
 */
export function PendingInvitationRow({
  invitation,
}: {
  invitation: PendingInvitation;
}) {
  const [result, setResult] = useState<StaffResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{invitation.name}</p>
          <p className="text-muted-foreground truncate text-sm">
            {invitation.email} ·{" "}
            {invitation.invitedAt
              ? `invité le ${invitation.invitedAt}`
              : "invitation non envoyée"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{ROLE_LABELS[invitation.role]}</Badge>
          <Badge variant="warning">En attente</Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(
                  await resendAccess({ profileId: invitation.profileId }),
                );
              })
            }
          >
            <Send aria-hidden />
            {pending ? "Envoi…" : "Renvoyer l'accès"}
          </Button>
        </div>
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          <p
            role="status"
            className={
              result.ok ? "text-success text-sm" : "text-destructive text-sm"
            }
          >
            {result.message}
          </p>
          {result.share && <InvitationShare share={result.share} />}
        </div>
      )}
    </li>
  );
}
