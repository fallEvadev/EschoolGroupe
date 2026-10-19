"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { updateMyPhone } from "@/lib/profile-actions";
import { myPhoneSchema } from "@/lib/validations/profile";

/** Changer son numéro de téléphone (vérifié ici puis par le serveur et la base). */
export function PhoneForm({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = myPhoneSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Numéro invalide.");
      return;
    }
    startTransition(async () => {
      const result = await updateMyPhone({ phone });
      if (result.ok) toast.success(result.message);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field id="my-phone" label="Téléphone" error={error ?? undefined}>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          placeholder="77 123 45 67"
          disabled={pending}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="w-full sm:w-auto sm:self-start"
      >
        {pending ? "Enregistrement…" : "Enregistrer le numéro"}
      </Button>
    </form>
  );
}
