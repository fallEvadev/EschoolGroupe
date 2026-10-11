"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ASSET_KINDS,
  ASSET_LABELS,
  MAX_ASSET_BYTES,
  type AssetKind,
} from "@/lib/org-assets";

import { uploadOrganizationAsset } from "./actions";

/** Images actuelles (adresses signées, valables quelques minutes) ou `null`. */
export type AssetUrls = Record<AssetKind, string | null>;

const HINTS: Record<AssetKind, string> = {
  logo: "Affiché en haut des bilans. Fond transparent de préférence.",
  signature: "Affichée en bas des bilans, au-dessus du nom du signataire.",
};

/** Logo et signature : aperçu, puis remplacement. Le serveur vérifie le vrai contenu. */
export function AssetsCard({ urls }: { urls: AssetUrls }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {ASSET_KINDS.map((kind) => (
        <AssetUploader key={kind} kind={kind} url={urls[kind]} />
      ))}
    </div>
  );
}

function AssetUploader({ kind, url }: { kind: AssetKind; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = ASSET_LABELS[kind];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const file = input.current?.files?.[0];
    if (!file) {
      setError("Choisissez une image PNG ou JPEG.");
      return;
    }
    // Contrôle immédiat avant tout envoi ; le serveur revérifie le contenu.
    if (file.size > MAX_ASSET_BYTES) {
      setError("L'image dépasse 500 Ko. Compressez-la puis recommencez.");
      return;
    }
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadOrganizationAsset(formData);
      if (result.ok) {
        toast.success(result.message);
        if (input.current) input.current.value = "";
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div>
        <h3 className="font-semibold">{label}</h3>
        <p className="text-muted-foreground text-sm">{HINTS[kind]}</p>
      </div>

      <div className="bg-muted/40 flex h-32 items-center justify-center rounded-lg border">
        {url ? (
          // Adresse signée temporaire d'un stockage privé : next/image n'apporte rien ici.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Aperçu : ${label}`}
            className="max-h-28 max-w-full object-contain"
          />
        ) : (
          <p className="text-muted-foreground text-sm">Aucune image</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`asset-${kind}`}>
          {url ? "Remplacer l'image" : "Choisir une image"}
        </Label>
        <Input
          id={`asset-${kind}`}
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          disabled={pending}
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Envoi…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
