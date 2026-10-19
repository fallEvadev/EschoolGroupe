"use client";

import { Download, FileCheck2, Mail, Send, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form";
import {
  BILAN_PDF_MIME,
  BILANS_BUCKET,
  formatFileSize,
  MAX_BILAN_PDF_BYTES,
} from "@/lib/bilan-pdf";
import { BILAN_STATUS_LABELS } from "@/lib/bilans";
import { summarizeDeliveries } from "@/lib/emails/bilan-published";
import { useSupabase } from "@/lib/supabase/client";
import { bilanPdfUploadSchema } from "@/lib/validations/bilans";

import {
  confirmBilanPdfUpload,
  prepareBilanPdfUpload,
  publishBilan,
  resendBilanEmails,
} from "./actions";

export type BilanRowData = {
  id: string;
  schoolName: string;
  status: string;
  reportCount: number;
  generatedAt: string;
  /** Texte déjà formaté : « généré le 12/10/2026 » ou « publié le … ». */
  dateLabel: string;
  pdf: { fileName: string; sizeBytes: number } | null;
  /** Suivi des e-mails d'un bilan publié (`null` pour un brouillon). */
  emails: { sent: number; failed: number } | null;
};

/**
 * Une ligne de bilan : télécharger le Word, déposer le PDF final, le consulter,
 * puis publier. Le serveur et la base revérifient tout (rôle, statut, vrai
 * contenu du PDF).
 */
export function BilanRow({ bilan }: { bilan: BilanRowData }) {
  const supabase = useSupabase();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const published = bilan.status === "publie";
  const busy = uploading || pending;

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const file = input.current?.files?.[0];
    if (!file) {
      setError("Choisissez le fichier PDF final.");
      return;
    }

    const meta = {
      bilanId: bilan.id,
      fileName: file.name,
      // Certains téléphones n'indiquent pas le type d'un .pdf.
      mimeType: file.type || (/\.pdf$/i.test(file.name) ? BILAN_PDF_MIME : ""),
      size: file.size,
    };
    // Contrôle immédiat (type, taille) avant tout envoi.
    const checked = bilanPdfUploadSchema.safeParse(meta);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Fichier invalide.");
      return;
    }

    setUploading(true);
    try {
      const prepared = await prepareBilanPdfUpload(meta);
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const { error: uploadError } = await supabase.storage
        .from(BILANS_BUCKET)
        .uploadToSignedUrl(prepared.storagePath, prepared.token, file, {
          contentType: BILAN_PDF_MIME,
        });
      if (uploadError) {
        setError("L'envoi a échoué. Vérifiez la connexion et recommencez.");
        return;
      }
      const confirmed = await confirmBilanPdfUpload({
        ...meta,
        storagePath: prepared.storagePath,
      });
      if (confirmed.ok) {
        toast.success(confirmed.message);
        if (input.current) input.current.value = "";
      } else {
        setError(confirmed.message);
      }
    } finally {
      setUploading(false);
    }
  }

  function resendEmails() {
    startTransition(async () => {
      const result = await resendBilanEmails({ bilanId: bilan.id });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function confirmPublish() {
    startTransition(async () => {
      const result = await publishBilan({ bilanId: bilan.id });
      if (result.ok) {
        toast.success(result.message);
        setConfirming(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words">{bilan.schoolName}</p>
          <p className="text-muted-foreground text-sm">
            {bilan.reportCount} rapport{bilan.reportCount > 1 ? "s" : ""} validé
            {bilan.reportCount > 1 ? "s" : ""} · {bilan.dateLabel}
          </p>
        </div>
        <Badge variant={published ? "success" : "neutral"}>
          {BILAN_STATUS_LABELS[bilan.status] ?? bilan.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          {/* Téléchargement d'un fichier : un lien classique, pas une page Next. */}
          <a href={`/admin/bilans/${bilan.id}/word`} download>
            <Download aria-hidden />
            Télécharger le Word
          </a>
        </Button>
        {bilan.pdf && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/admin/bilans/${bilan.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileCheck2 aria-hidden />
              Voir le PDF final ({formatFileSize(bilan.pdf.sizeBytes)})
            </a>
          </Button>
        )}
        {!published && bilan.pdf && (
          <Button size="sm" disabled={busy} onClick={() => setConfirming(true)}>
            <Send aria-hidden />
            Publier
          </Button>
        )}
      </div>

      {published && bilan.emails && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {bilan.emails.sent + bilan.emails.failed === 0
              ? "Aucun e-mail envoyé aux directeurs."
              : summarizeDeliveries({
                  configured: true,
                  sent: bilan.emails.sent,
                  failed: bilan.emails.failed,
                })}
          </span>
          {/* Renvoi : seulement s'il reste des directeurs à prévenir (échecs ou aucun envoi). */}
          {(bilan.emails.failed > 0 ||
            bilan.emails.sent + bilan.emails.failed === 0) && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={resendEmails}
            >
              <Mail aria-hidden />
              {pending ? "Envoi…" : "Renvoyer les e-mails"}
            </Button>
          )}
        </div>
      )}

      {!published && (
        <form onSubmit={upload} className="flex flex-col gap-2" noValidate>
          <Label htmlFor={`pdf-${bilan.id}`}>
            {bilan.pdf
              ? "Remplacer le PDF final"
              : "Déposer le PDF final (après relecture du Word)"}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`pdf-${bilan.id}`}
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
            />
            <Button type="submit" variant="outline" disabled={busy}>
              <Upload aria-hidden />
              {uploading ? "Envoi…" : "Déposer"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            PDF uniquement, {formatFileSize(MAX_BILAN_PDF_BYTES)} au maximum.
          </p>
          <FormError>{error}</FormError>
        </form>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={(value) => {
          if (!pending) setConfirming(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier ce bilan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bilan de « {bilan.schoolName} » est figé : on ne pourra plus
              ajouter de rapport ni remplacer le PDF. Vérifiez que le PDF final
              est le bon avant de publier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                // Pas de fermeture automatique : on attend la réponse du serveur.
                event.preventDefault();
                confirmPublish();
              }}
            >
              {pending ? "Publication…" : "Publier le bilan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
