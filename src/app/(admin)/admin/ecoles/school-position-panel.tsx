"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/form";
import { mapsUrl, parseCoordinatePair } from "@/lib/schools";
import { schoolPositionSchema } from "@/lib/validations/schools";

import { setSchoolPositionManual } from "./actions";

/**
 * Enregistrement de la position d'une école par la Direction : on copie les
 * coordonnées dans Google Maps (« 14.6928, -17.4467 ») et on les colle dans un
 * seul champ. Un lien permet de contrôler sur la carte avant d'enregistrer.
 * Ouvert tant que l'école n'a pas de position, replié ensuite (pour la corriger).
 */
export function SchoolPositionPanel({
  schoolId,
  hasPosition,
}: {
  schoolId: string;
  hasPosition: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pair = parseCoordinatePair(text);
  const checked = pair
    ? schoolPositionSchema.safeParse({ schoolId, ...pair })
    : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!pair || !checked) {
      setError(
        "Collez les deux nombres copiés dans Google Maps, par exemple : 14.6928, -17.4467",
      );
      return;
    }
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Coordonnées invalides.");
      return;
    }
    startTransition(async () => {
      const result = await setSchoolPositionManual({ schoolId, ...pair });
      if (result.ok) {
        toast.success(result.message);
        setText("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <details className="rounded-xl border p-3" open={!hasPosition}>
      <summary className="cursor-pointer text-sm font-medium">
        {hasPosition
          ? "Corriger la position de l'école"
          : "Enregistrer la position de l'école"}
      </summary>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>
            Ouvrez{" "}
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline"
            >
              Google Maps
            </a>{" "}
            et trouvez l&apos;école.
          </li>
          <li>
            Appuyez longtemps (ou clic droit) sur le bâtiment : des chiffres
            apparaissent. Touchez-les pour les copier.
          </li>
          <li>Collez-les ci-dessous, puis contrôlez sur la carte.</li>
        </ol>
        <Field id="manual-coordinates" label="Coordonnées">
          <Input
            inputMode="text"
            placeholder="14.692800, -17.446700"
            value={text}
            disabled={pending}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        {checked?.success && (
          <p className="text-sm">
            Latitude {checked.data.latitude}, longitude {checked.data.longitude}
            .{" "}
            <a
              href={mapsUrl(checked.data.latitude, checked.data.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline"
            >
              Contrôler sur la carte
            </a>
          </p>
        )}
        <FormError>{error}</FormError>
        <div>
          <Button
            className="w-full sm:w-auto"
            type="submit"
            disabled={pending || !checked?.success}
          >
            {pending ? "Enregistrement…" : "Enregistrer la position"}
          </Button>
        </div>
      </form>
    </details>
  );
}
