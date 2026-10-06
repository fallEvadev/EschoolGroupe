"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { acceptRules } from "./actions";

/** Case « J'ai lu et j'accepte » : le bouton reste grisé tant qu'elle n'est pas cochée. */
export function AcceptRulesForm({
  rulesId,
  homeHref,
}: {
  rulesId: string;
  /** Page d'accueil de la personne, où l'on va après l'acceptation. */
  homeHref: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await acceptRules({ rulesId, accepted: checked });
      if (result.ok) {
        toast.success(result.message);
        router.push(homeHref);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <input
          id="accept-rules"
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => setChecked(event.target.checked)}
          className="accent-primary mt-1 size-5 shrink-0"
        />
        <Label htmlFor="accept-rules" className="leading-snug font-medium">
          J&apos;ai lu le règlement intérieur ci-dessus et je m&apos;engage à le
          respecter.
        </Label>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div>
        <Button onClick={submit} disabled={!checked || pending}>
          {pending ? "Enregistrement…" : "Accepter le règlement"}
        </Button>
      </div>
    </div>
  );
}
