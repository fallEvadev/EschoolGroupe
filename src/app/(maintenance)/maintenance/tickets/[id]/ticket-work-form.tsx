"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/ui/form";
import { resolveTicketSchema } from "@/lib/validations/tickets";

import { resolveTicket, startTicket } from "../../actions";

/**
 * Actions du maintenancier sur un ticket : prendre en charge, puis marquer
 * résolu avec une note d'intervention. Le serveur et la base revérifient tout
 * (ticket affecté à l'appelant, statut, longueur de la note).
 */
export function TicketWorkForm({
  ticketId,
  status,
}: {
  ticketId: string;
  status: "ouvert" | "en_cours";
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startTicket({ ticketId });
      if (result.ok) toast.success(result.message);
      else setError(result.message);
    });
  }

  function resolve(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = resolveTicketSchema.safeParse({ ticketId, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Données invalides.");
      return;
    }
    startTransition(async () => {
      const result = await resolveTicket(parsed.data);
      if (result.ok) toast.success(result.message);
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {status === "ouvert" && (
        <Button
          size="lg"
          className="w-full sm:w-auto sm:self-start"
          disabled={pending}
          onClick={start}
        >
          {pending ? "Enregistrement…" : "Prendre en charge"}
        </Button>
      )}

      <form onSubmit={resolve} className="flex flex-col gap-3" noValidate>
        <Field id="resolution-note" label="Note d'intervention">
          <Textarea
            value={note}
            maxLength={500}
            placeholder="Ce que vous avez fait (ex. : câble d'alimentation remplacé)"
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <FormError>{error}</FormError>
        <Button
          type="submit"
          size="lg"
          variant="outline"
          className="w-full sm:w-auto sm:self-start"
          disabled={pending}
        >
          {pending ? "Enregistrement…" : "Marquer résolu"}
        </Button>
      </form>
    </div>
  );
}
