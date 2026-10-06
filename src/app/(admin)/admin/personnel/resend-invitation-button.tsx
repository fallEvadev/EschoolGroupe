"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { StaffResult } from "@/lib/validations/staff";

import { resendInvitation } from "./actions";

/** Renvoie l'invitation d'une recrue (l'ancien lien est annulé). */
export function ResendInvitationButton({ profileId }: { profileId: string }) {
  const [result, setResult] = useState<StaffResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await resendInvitation({ profileId }));
          })
        }
      >
        <Send aria-hidden />
        {pending ? "Envoi…" : "Renvoyer l'invitation"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={
          result?.ok ? "text-success text-sm" : "text-destructive text-sm"
        }
      >
        {result?.message}
      </p>
    </div>
  );
}
