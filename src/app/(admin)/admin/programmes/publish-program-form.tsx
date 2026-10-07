"use client";

import { CheckCircle2, MessageCircle, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMonthLabel, isIsoMonth } from "@/lib/dates";
import {
  defaultProgramTitle,
  PROGRAM_MIME_TYPE,
  PROGRAMS_BUCKET,
} from "@/lib/programs";
import { useSupabase } from "@/lib/supabase/client";
import { programUploadSchema } from "@/lib/validations/programs";

import { confirmProgramUpload, prepareProgramUpload } from "./actions";

type Published = { message: string; whatsappUrl: string };

/**
 * Publie le programme d'un mois : le PDF part directement au stockage, puis le
 * serveur vérifie que c'est un vrai PDF avant de le publier. Un programme déjà
 * publié pour le même mois est remplacé (et conservé).
 */
export function PublishProgramForm({ defaultMonth }: { defaultMonth: string }) {
  const supabase = useSupabase();
  const [month, setMonth] = useState(defaultMonth);
  const [title, setTitle] = useState(
    defaultProgramTitle(formatMonthLabel(defaultMonth)),
  );
  const [titleEdited, setTitleEdited] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<Published | null>(null);

  function changeMonth(value: string) {
    setMonth(value);
    // Le titre suit le mois tant que la personne ne l'a pas modifié.
    if (!titleEdited && isIsoMonth(value)) {
      setTitle(defaultProgramTitle(formatMonthLabel(value)));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choisissez le fichier PDF du programme.");
      return;
    }

    const meta = {
      month,
      title,
      fileName: file.name,
      // Certains téléphones n'indiquent pas le type d'un .pdf.
      mimeType:
        file.type || (/\.pdf$/i.test(file.name) ? PROGRAM_MIME_TYPE : ""),
      size: file.size,
    };
    // Contrôle immédiat (type, taille, titre) avant tout envoi.
    const checked = programUploadSchema.safeParse(meta);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Fichier invalide.");
      return;
    }

    setBusy(true);
    try {
      const prepared = await prepareProgramUpload(meta);
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const { error: uploadError } = await supabase.storage
        .from(PROGRAMS_BUCKET)
        .uploadToSignedUrl(prepared.storagePath, prepared.token, file, {
          contentType: PROGRAM_MIME_TYPE,
        });
      if (uploadError) {
        setError("L'envoi a échoué. Vérifiez la connexion et recommencez.");
        return;
      }
      const confirmed = await confirmProgramUpload({
        ...meta,
        storagePath: prepared.storagePath,
      });
      if (confirmed.ok) {
        setPublished(confirmed);
        setFile(null);
      } else {
        setError(confirmed.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    return (
      <Card className="flex flex-col gap-4 p-4 sm:p-6" role="status">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="text-success mt-0.5 size-6 shrink-0"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{published.message}</p>
            <p className="text-muted-foreground text-sm">
              Les formateurs le voient dès maintenant sur leur accueil. Vous
              pouvez les prévenir par WhatsApp : choisissez ensuite leur groupe.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="whatsapp" asChild>
            <a
              href={published.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden />
              Prévenir les formateurs par WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={() => setPublished(null)}>
            Publier un autre programme
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <h2 className="text-lg font-semibold">Publier un programme</h2>
          <p className="text-muted-foreground text-sm">
            Un seul programme est en vigueur par mois : en publier un nouveau
            pour le même mois remplace l&apos;ancien, qui reste conservé.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="program-month">Mois concerné</Label>
            <Input
              id="program-month"
              type="month"
              value={month}
              disabled={busy}
              onChange={(event) => changeMonth(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="program-title">Titre</Label>
            <Input
              id="program-title"
              value={title}
              disabled={busy}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleEdited(true);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="program-file">Fichier PDF (10 Mo maximum)</Label>
          <Input
            id="program-file"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        )}

        <div>
          <Button type="submit" disabled={busy}>
            <Upload aria-hidden />
            {busy ? "Publication…" : "Publier le programme"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
