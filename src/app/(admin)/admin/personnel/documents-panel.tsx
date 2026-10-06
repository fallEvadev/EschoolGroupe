"use client";

import { CheckCircle2, CircleDashed, Eye, Upload } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_TYPES,
  DOCUMENT_KINDS,
  DOCUMENT_LABELS,
  formatFileSize,
  REQUIRED_DOCUMENT_KINDS,
  STAFF_DOCUMENTS_BUCKET,
  type DocumentKind,
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
} from "./document-actions";

export type CurrentDocument = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  sizeBytes: number;
  /** Date d'envoi déjà formatée côté serveur (jj/mm/aaaa). */
  uploadedOn: string;
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

  const byKind = new Map(documents.map((doc) => [doc.kind, doc]));
  const requiredDone = REQUIRED_DOCUMENT_KINDS.filter((k) =>
    byKind.has(k),
  ).length;

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
          {requiredDone} / {REQUIRED_DOCUMENT_KINDS.length} pièces obligatoires
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
                  <CheckCircle2
                    className="text-success size-6 shrink-0"
                    aria-label="Reçu"
                  />
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
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {doc
                      ? `${doc.fileName} · ${formatFileSize(doc.sizeBytes)} · reçu le ${doc.uploadedOn}`
                      : "Non reçu"}
                  </p>
                </div>
                <div className="flex gap-2">
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
    </section>
  );
}
