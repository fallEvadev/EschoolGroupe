"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/form";
import { parseCoordinatePair } from "@/lib/schools";
import { schoolPositionSchema } from "@/lib/validations/schools";

import { setSchoolPositionManual } from "./actions";

/**
 * Saisie manuelle de la position d'une école : un SECOURS, replié par défaut.
 * Le cas normal est que le directeur de l'école l'enregistre sur place depuis
 * son téléphone. Coller « 14.6928, -17.4467 » (format Google Maps) dans
 * Latitude remplit les deux champs.
 */
export function SchoolPositionPanel({ schoolId }: { schoolId: string }) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeLatitude(value: string) {
    const pair = parseCoordinatePair(value);
    if (pair) {
      setLatitude(pair.latitude);
      setLongitude(pair.longitude);
    } else {
      setLatitude(value);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = { schoolId, latitude, longitude };
    // Contrôle immédiat (bornes, champs vides) avant l'envoi.
    const checked = schoolPositionSchema.safeParse(input);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Coordonnées invalides.");
      return;
    }
    startTransition(async () => {
      const result = await setSchoolPositionManual(input);
      if (result.ok) {
        toast.success(result.message);
        setLatitude("");
        setLongitude("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Saisir la position à la main (secours)
      </summary>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
        <p className="text-muted-foreground text-sm">
          À utiliser seulement si le directeur ne peut pas l&apos;enregistrer
          lui-même. Dans{" "}
          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
          >
            Google Maps
          </a>
          , faites un clic droit sur l&apos;école puis cliquez sur les chiffres
          pour les copier, et collez-les dans le champ Latitude.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="manual-latitude" label="Latitude">
            <Input
              inputMode="decimal"
              placeholder="14.692800"
              value={latitude}
              disabled={pending}
              onChange={(event) => changeLatitude(event.target.value)}
            />
          </Field>
          <Field id="manual-longitude" label="Longitude">
            <Input
              inputMode="decimal"
              placeholder="-17.446700"
              value={longitude}
              disabled={pending}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </Field>
        </div>
        <FormError>{error}</FormError>
        <div>
          <Button
            className="w-full sm:w-auto"
            type="submit"
            variant="outline"
            disabled={pending}
          >
            {pending ? "Enregistrement…" : "Enregistrer la position"}
          </Button>
        </div>
      </form>
    </details>
  );
}
