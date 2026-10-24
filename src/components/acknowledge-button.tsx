"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { startTicket } from "@/app/(maintenance)/maintenance/actions";
import { Button } from "@/components/ui/button";

/**
 * « Bien reçu » : le maintenancier prend la panne en charge et le formateur qui
 * l'a signalée est prévenu. Le serveur et la base revérifient les droits.
 */
export function AcknowledgeButton({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className="w-full sm:w-auto"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startTicket({ ticketId });
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      <Check aria-hidden />
      {pending ? "Enregistrement…" : "Bien reçu"}
    </Button>
  );
}
