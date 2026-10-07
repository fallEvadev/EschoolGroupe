"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SchoolResult } from "@/lib/validations/schools";

import { addDirector, removeDirector } from "./actions";

export type PersonOption = { id: string; name: string };

const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:text-sm";

/** Directeurs partenaires rattachés à l'école : ils verront ses codes du jour. */
export function DirectorsPanel({
  schoolId,
  directors,
  candidates,
  disabled,
}: {
  schoolId: string;
  directors: PersonOption[];
  /** Directeurs actifs qui ne sont pas encore rattachés à cette école. */
  candidates: PersonOption[];
  /** École archivée : plus de modification. */
  disabled: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  function notify(result: SchoolResult) {
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addDirector({ schoolId, profileId: selected });
      notify(result);
      if (result.ok) setSelected("");
    });
  }

  function remove(profileId: string) {
    startTransition(async () => {
      notify(await removeDirector({ schoolId, profileId }));
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Directeurs partenaires
      </h3>

      {directors.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun directeur rattaché : personne ne pourra lire le code du jour de
          cette école.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-xl border">
          {directors.map((director) => (
            <li
              key={director.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span className="font-medium">{director.name}</span>
              {!disabled && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => remove(director.id)}
                  aria-label={`Retirer ${director.name}`}
                >
                  <UserMinus aria-hidden />
                  Retirer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled &&
        (candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun autre directeur partenaire actif à rattacher. Créez-le
            d&apos;abord dans « Personnel » avec le rôle Directeur partenaire.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="director-select">Rattacher un directeur</Label>
              <select
                id="director-select"
                value={selected}
                disabled={pending}
                onChange={(event) => setSelected(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Choisir…</option>
                {candidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={add} disabled={!selected || pending}>
              <UserPlus aria-hidden />
              Rattacher
            </Button>
          </div>
        ))}
    </section>
  );
}
