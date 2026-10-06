"use client";

import {
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPTED_TYPES,
  DOCUMENT_KINDS,
  DOCUMENT_LABELS,
  formatFileSize,
  REQUIRED_DOCUMENT_KINDS,
  REVIEW_BADGE,
  REVIEW_LABELS,
  reviewProgress,
  STAFF_DOCUMENTS_BUCKET,
  type DocumentKind,
  type ReviewDecision,
  type ReviewStatus,
} from "@/lib/staff-documents";
import { useSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  documentUploadSchema,
  type DocumentResult,
} from "@/lib/validations/staff-documents";

import {
  confirmDocumentUpload,
  getDocumentUrl,
  prepareDocumentUpload,
  reviewDocument,
} from "./document-actions";

export type CurrentDocument = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  sizeBytes: number;
  /** Date d'envoi déjà formatée côté serveur (jj/mm/aaaa). */
  uploadedOn: string;
  reviewStatus: ReviewStatus;
  /** Motif du rejet (seulement si la pièce est rejetée). */
  reviewReason: string | null;
};

/** Dossier administratif d'une fiche : une ligne par type de document. */
export function DocumentsPanel({
  profileId,
  documents,
}: {
  profileId: string;
  documents: CurrentDocument[];
}) {
  const supabase = useSupabase();
  const [busy, setBusy] = useState<DocumentKind | null>(null);
  const [result, setResult] = useState<
    (DocumentResult & { kind: DocumentKind }) | null
  >(null);

  const [rejecting, setRejecting] = useState<CurrentDocument | null>(null);
  const [reason, setReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, startReview] = useTransition();

  const byKind = new Map(documents.map((doc) => [doc.kind, doc]));
  const progress = reviewProgress(documents);

  function closeRejection() {
    setRejecting(null);
    setReason("");
    setReviewError(null);
  }

  /** Valide ou rejette une pièce ; un rejet garde la fenêtre ouverte en cas d'erreur. */
  function review(doc: CurrentDocument, decision: ReviewDecision) {
    setReviewError(null);
    startReview(async () => {
      const response = await reviewDocument({
        documentId: doc.id,
        decision,
        reason,
      });
      if (response.ok) {
        toast.success(response.message);
        closeRejection();
      } else if (decision === "rejete") {
        setReviewError(response.message);
      } else {
        toast.error(response.message);
      }
    });
  }

  async function upload(kind: DocumentKind, file: File) {
    setResult(null);
    const meta = {
      profileId,
      kind,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    };
    // Contrôle immédiat (format, taille) avant tout envoi.
    const checked = documentUploadSchema.safeParse(meta);
    if (!checked.success) {
      setResult({
        kind,
        ok: false,
        message: checked.error.issues[0]?.message ?? "Fichier invalide.",
      });
      return;
    }

    setBusy(kind);
    try {
      const prepared = await prepareDocumentUpload(meta);
      if (!prepared.ok) {
        setResult({ kind, ...prepared });
        return;
      }
      const { error } = await supabase.storage
        .from(STAFF_DOCUMENTS_BUCKET)
        .uploadToSignedUrl(prepared.storagePath, prepared.token, file, {
          contentType: file.type,
        });
      if (error) {
        setResult({
          kind,
          ok: false,
          message: "L'envoi a échoué. Vérifiez la connexion et recommencez.",
        });
        return;
      }
      const confirmed = await confirmDocumentUpload({
        ...meta,
        storagePath: prepared.storagePath,
      });
      setResult({ kind, ...confirmed });
    } finally {
      setBusy(null);
    }
  }

  async function view(doc: CurrentDocument) {
    setResult(null);
    // Onglet ouvert tout de suite (sinon le navigateur le bloque).
    const tab = window.open("", "_blank");
    const response = await getDocumentUrl({ documentId: doc.id });
    if (response.ok && tab) {
      tab.opener = null;
      tab.location.href = response.url;
    } else {
      tab?.close();
      setResult({
        kind: doc.kind,
        ok: false,
        message: response.ok
          ? "Autorisez l'ouverture des onglets pour voir le document."
          : response.message,
      });
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
          Dossier administratif
        </h3>
        <span className="text-muted-foreground text-sm">
          {progress.requiredValidated} / {REQUIRED_DOCUMENT_KINDS.length} pièces
          obligatoires validées
        </span>
      </div>

      <ul className="divide-border divide-y rounded-xl border">
        {DOCUMENT_KINDS.map((kind) => {
          const doc = byKind.get(kind);
          const required = REQUIRED_DOCUMENT_KINDS.includes(kind);
          const inputId = `document-${kind}`;
          const rowResult = result?.kind === kind ? result : null;

          return (
            <li key={kind} className="flex flex-col gap-2 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                {doc ? (
                  doc.reviewStatus === "valide" ? (
                    <CheckCircle2
                      className="text-success size-6 shrink-0"
                      aria-label="Validé"
                    />
                  ) : doc.reviewStatus === "rejete" ? (
                    <XCircle
                      className="text-destructive size-6 shrink-0"
                      aria-label="Rejeté"
                    />
                  ) : (
                    <Clock
                      className="text-warning size-6 shrink-0"
                      aria-label="À vérifier"
                    />
                  )
                ) : (
                  <CircleDashed
                    className="text-muted-foreground size-6 shrink-0"
                    aria-label="Manquant"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {DOCUMENT_LABELS[kind]}
                    {required && !doc && (
                      <Badge variant="warning" className="ml-2">
                        Obligatoire
                      </Badge>
                    )}
                    {doc && (
                      <Badge
                        variant={REVIEW_BADGE[doc.reviewStatus]}
                        className="ml-2"
                      >
                        {REVIEW_LABELS[doc.reviewStatus]}
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {doc
                      ? `${doc.fileName} · ${formatFileSize(doc.sizeBytes)} · reçu le ${doc.uploadedOn}`
                      : "Non reçu"}
                  </p>
                  {doc?.reviewStatus === "rejete" && doc.reviewReason && (
                    <p className="text-destructive text-sm">
                      Motif du rejet : {doc.reviewReason}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {doc && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => view(doc)}
                    >
                      <Eye aria-hidden />
                      Voir
                    </Button>
                  )}
                  {doc && doc.reviewStatus !== "valide" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null || reviewing}
                      onClick={() => review(doc, "valide")}
                    >
                      <Check aria-hidden />
                      Valider
                    </Button>
                  )}
                  {doc && doc.reviewStatus !== "rejete" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null || reviewing}
                      onClick={() => setRejecting(doc)}
                    >
                      <X aria-hidden />
                      Rejeter
                    </Button>
                  )}
                  {/* Le bouton ouvre le sélecteur de fichier caché. */}
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "border-input bg-card hover:bg-muted inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                      "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                      busy !== null && "pointer-events-none opacity-50",
                    )}
                  >
                    <Upload className="size-4" aria-hidden />
                    {busy === kind ? "Envoi…" : doc ? "Remplacer" : "Ajouter"}
                    <input
                      id={inputId}
                      type="file"
                      accept={ACCEPTED_TYPES[kind].join(",")}
                      className="sr-only"
                      disabled={busy !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void upload(kind, file);
                      }}
                    />
                  </label>
                </div>
              </div>
              {rowResult && (
                <p
                  role="status"
                  className={
                    rowResult.ok
                      ? "text-success text-sm"
                      : "text-destructive text-sm"
                  }
                >
                  {rowResult.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-xs">
        PDF, JPEG, PNG ou WebP, 5 Mo maximum. Les documents sont privés : chaque
        consultation est enregistrée dans le journal d&apos;audit.
      </p>

      <AlertDialog
        open={rejecting !== null}
        onOpenChange={(value) => {
          if (!value && !reviewing) closeRejection();
        }}
      >
        <AlertDialogContent>
          {rejecting && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Rejeter : {DOCUMENT_LABELS[rejecting.kind]} ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Expliquez ce qui doit être corrigé. Le motif reste sur la
                  fiche pour que la personne puisse en être informée.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex flex-col gap-2">
                <Label htmlFor="review-reason">Motif (obligatoire)</Label>
                <Textarea
                  id="review-reason"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  disabled={reviewing}
                  aria-invalid={!!reviewError}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Photo floue, document illisible, pièce expirée…"
                />
              </div>
              {reviewError && (
                <p role="alert" className="text-destructive text-sm">
                  {reviewError}
                </p>
              )}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={reviewing}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={reviewing}
                  onClick={(event) => {
                    // Pas de fermeture automatique : on attend la réponse du serveur.
                    event.preventDefault();
                    review(rejecting, "rejete");
                  }}
                >
                  {reviewing ? "Enregistrement…" : "Rejeter la pièce"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
