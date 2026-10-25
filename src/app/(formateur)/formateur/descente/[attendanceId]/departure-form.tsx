"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitDeparture } from "@/app/(formateur)/formateur/pointage/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form";
import { CODE_LENGTH, isCodeFormat } from "@/lib/daily-codes";
import { notify } from "@/lib/notify";

/**
 * Saisie du code donné par le directeur après le cours. Le serveur décide de
 * tout (heure de fin, essais limités, code) ; ici on vérifie seulement le
 * format pour éviter un aller-retour inutile.
 */
export function DepartureForm({ attendanceId }: { attendanceId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isCodeFormat(code)) {
      setError(`Le code a ${CODE_LENGTH} chiffres.`);
      return;
    }
    startTransition(async () => {
      const result = await submitDeparture({ attendanceId, code });
      if (result.ok) {
        setDone(result.message);
        notify(result);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          className="bg-success-soft text-success flex items-start gap-2 rounded-lg p-3 font-medium"
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          {done}
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={`/formateur/cahiers/${attendanceId}`}>
            Ouvrir mon rapport
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="departure-code">Code du directeur</Label>
        <Input
          id="departure-code"
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="000000"
          disabled={pending}
          aria-invalid={!!error}
          aria-describedby="departure-code-help"
          // Chiffres seulement, au fil de la saisie.
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
          className="h-14 text-center text-3xl font-bold tracking-[0.3em] tabular-nums"
        />
        <p id="departure-code-help" className="text-muted-foreground text-sm">
          Le directeur vous donne ce code quand le cours est terminé.
        </p>
      </div>

      <FormError>{error}</FormError>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || code.length !== CODE_LENGTH}
      >
        {pending ? "Vérification…" : "Valider ma descente"}
      </Button>
    </form>
  );
}
