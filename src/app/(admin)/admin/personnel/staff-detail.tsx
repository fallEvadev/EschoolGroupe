import { Mail, Phone } from "lucide-react";
import Link from "next/link";

import { BackLink } from "@/components/layout/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  availableStatusActions,
  CONTRACT_LABELS,
  formatPhone,
  initials,
  isContractType,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/lib/staff";
import {
  isDocumentKind,
  isReviewStatus,
  STAFF_DOCUMENTS_BUCKET,
} from "@/lib/staff-documents";
import { createServerSupabase } from "@/lib/supabase/server";

import { DocumentsPanel, type CurrentDocument } from "./documents-panel";
import { NoteForm } from "./note-form";
import { ResendInvitationButton } from "./resend-invitation-button";
import { StatusActions } from "./status-actions";

import { type Profile, statusOf } from "./directory";

/** Fiche détaillée d'une personne (panneau de droite). */
export async function StaffDetail({
  profile,
  canManage,
  isSelf,
  backHref,
}: {
  profile: Profile;
  canManage: boolean;
  isSelf: boolean;
  backHref: string;
}) {
  const status = statusOf(profile);
  // Un directeur d'école partenaire n'a ni dossier administratif (CV, CNI,
  // photo), ni spécialité, ni contrat : on ne les charge ni ne les affiche.
  const hasDossier = profile.role !== "directeur_partenaire";
  const supabase = await createServerSupabase();
  // Le dossier et la note d'un administrateur ne sont pas chargés pour un
  // Admin RH : ils restent gérés par le Super-Admin (`canManage` faux).
  const [noteResult, documentsResult] = await Promise.all([
    canManage
      ? supabase
          .from("staff_notes")
          .select("content")
          .eq("profile_id", profile.id)
          .maybeSingle()
      : null,
    canManage && hasDossier
      ? supabase
          .from("staff_documents")
          .select(
            "id, kind, file_name, size_bytes, storage_path, created_at, review_status, review_reason",
          )
          .eq("profile_id", profile.id)
          .eq("status", "actif")
      : null,
  ]);
  const note = noteResult?.data ?? null;
  const documentRows = documentsResult?.data ?? null;

  const documents: CurrentDocument[] = (documentRows ?? []).flatMap((doc) =>
    isDocumentKind(doc.kind)
      ? [
          {
            id: doc.id,
            kind: doc.kind,
            fileName: doc.file_name,
            sizeBytes: doc.size_bytes,
            uploadedOn: formatDate(doc.created_at),
            reviewStatus: isReviewStatus(doc.review_status)
              ? doc.review_status
              : "a_verifier",
            reviewReason: doc.review_reason,
          },
        ]
      : [],
  );

  // Photo affichée dans la pastille : lien temporaire (5 minutes).
  const photo = documentRows?.find((doc) => doc.kind === "photo");
  const photoUrl = photo
    ? (
        await supabase.storage
          .from(STAFF_DOCUMENTS_BUCKET)
          .createSignedUrl(photo.storage_path, 300)
      ).data?.signedUrl
    : undefined;

  const contract =
    profile.contract_type && isContractType(profile.contract_type)
      ? CONTRACT_LABELS[profile.contract_type]
      : null;

  const infos: { label: string; value: string }[] = [
    { label: "E-mail", value: profile.email },
    {
      label: "Téléphone",
      value: profile.phone ? formatPhone(profile.phone) : "Non renseigné",
    },
    { label: "Rôle", value: ROLE_LABELS[profile.role] },
    ...(hasDossier
      ? [
          { label: "Contrat", value: contract ?? "Non renseigné" },
          {
            label: "Date d'arrivée",
            value: profile.hire_date
              ? formatDate(profile.hire_date)
              : "Non renseignée",
          },
        ]
      : []),
    { label: "Fiche créée le", value: formatDate(profile.created_at) },
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-4 border-b p-4 sm:p-6">
        <BackLink href={backHref} className="lg:hidden">
          Retour à l&apos;annuaire
        </BackLink>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {photoUrl ? (
            // Lien signé qui change à chaque affichage : pas d'optimisation
            // d'image Next.js possible ni utile ici.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Photo de ${profile.full_name}`}
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="bg-accent text-accent-foreground font-heading flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
            >
              {initials(profile.full_name)}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="truncate text-2xl font-bold">{profile.full_name}</h2>
            {hasDossier && (
              <p className="text-muted-foreground">
                {[profile.job_title ?? "Spécialité non renseignée", contract]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge>{ROLE_LABELS[profile.role]}</Badge>
              <Badge variant={STATUS_BADGE[status]}>
                {STATUS_LABELS[status]}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" asChild>
              <a
                href={`mailto:${profile.email}`}
                aria-label={`Écrire à ${profile.full_name}`}
              >
                <Mail aria-hidden />
              </a>
            </Button>
            {profile.phone && (
              <Button variant="outline" size="icon" asChild>
                <a
                  href={`tel:${profile.phone}`}
                  aria-label={`Appeler ${profile.full_name}`}
                >
                  <Phone aria-hidden />
                </a>
              </Button>
            )}
            {canManage && (
              <Button variant="outline" asChild>
                <Link href={`/admin/personnel/${profile.id}/modifier`}>
                  Modifier la fiche
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {status === "invite" && (
          <section className="bg-warning-soft flex flex-col gap-3 rounded-xl p-4">
            <p className="text-warning text-sm font-medium">
              {profile.invited_at
                ? `Invitation envoyée le ${formatDateTime(profile.invited_at)}. `
                : "L'invitation n'a pas encore pu être envoyée. "}
              Le compte sera actif quand la personne aura choisi son mot de
              passe.
            </p>
            {canManage && <ResendInvitationButton profileId={profile.id} />}
          </section>
        )}

        {(status === "inactif" || status === "archive") &&
          profile.status_reason && (
            <section className="bg-muted flex flex-col gap-1 rounded-xl p-4">
              <p className="text-sm font-medium">
                {status === "archive" ? "Fiche archivée" : "Compte désactivé"}
                {profile.status_changed_at &&
                  ` le ${formatDateTime(profile.status_changed_at)}`}
              </p>
              <p className="text-muted-foreground text-sm">
                Motif : {profile.status_reason}
              </p>
            </section>
          )}

        {canManage && !isSelf && (
          <StatusActions
            profileId={profile.id}
            fullName={profile.full_name}
            actions={availableStatusActions(
              status,
              profile.clerk_user_id !== null,
            )}
          />
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
            Informations
          </h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {infos.map((info) => (
              <div key={info.label} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-sm">{info.label}</dt>
                <dd className="font-medium break-words">{info.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {canManage ? (
          <>
            {hasDossier && (
              <DocumentsPanel profileId={profile.id} documents={documents} />
            )}

            <section className="border-t pt-6">
              <NoteForm profileId={profile.id} initial={note?.content ?? ""} />
            </section>
          </>
        ) : (
          <p className="text-muted-foreground border-t pt-6 text-sm">
            Le dossier et la note de suivi des administrateurs sont gérés par le
            Super-Admin.
          </p>
        )}
      </div>
    </Card>
  );
}
