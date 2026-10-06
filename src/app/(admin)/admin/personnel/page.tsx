import { ArrowLeft, Mail, Phone, Plus, Search } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assignableRoles, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  CONTRACT_LABELS,
  formatPhone,
  initials,
  isContractType,
  isStaffStatus,
  STATUS_BADGE,
  STATUS_LABELS,
  type StaffStatus,
} from "@/lib/staff";
import { isDocumentKind, STAFF_DOCUMENTS_BUCKET } from "@/lib/staff-documents";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

import { requireStaffManager } from "./access";
import { DocumentsPanel, type CurrentDocument } from "./documents-panel";
import { NoteForm } from "./note-form";
import { ResendInvitationButton } from "./resend-invitation-button";

export const metadata = { title: "Personnel · E-School Groupe" };

type Profile = Tables<"profiles">;

/** Onglets de filtre de l'annuaire. */
const FILTERS = [
  { key: "tous", label: "Tous", statuses: null },
  { key: "actifs", label: "Actifs", statuses: ["actif"] },
  { key: "invites", label: "Invités", statuses: ["invite"] },
  { key: "inactifs", label: "Inactifs", statuses: ["inactif", "archive"] },
] as const satisfies readonly {
  key: string;
  label: string;
  statuses: readonly StaffStatus[] | null;
}[];

type FilterKey = (typeof FILTERS)[number]["key"];

/** Texte comparable : minuscules et sans accents (« Aïssatou » = « aissatou »). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function statusOf(profile: Profile): StaffStatus {
  return isStaffStatus(profile.status) ? profile.status : "inactif";
}

/** Adresse de la page en gardant la recherche et le filtre en cours. */
function personnelHref(params: {
  q?: string;
  filtre?: FilterKey;
  fiche?: string;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.filtre && params.filtre !== "tous")
    search.set("filtre", params.filtre);
  if (params.fiche) search.set("fiche", params.fiche);
  const query = search.toString();
  return query ? `/admin/personnel?${query}` : "/admin/personnel";
}

async function loadProfiles(): Promise<
  { profiles: Profile[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  // Client avec le jeton de l'utilisateur : la RLS limite la lecture aux RH.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .limit(500);
  if (error) return { error: describeSupabaseError("profiles", error).message };
  return { profiles: data };
}

export default async function PersonnelPage({
  searchParams,
}: PageProps<"/admin/personnel">) {
  const role = await requireStaffManager();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filtre: FilterKey =
    FILTERS.find((f) => f.key === params.filtre)?.key ?? "tous";
  const ficheId = typeof params.fiche === "string" ? params.fiche : undefined;

  const loaded = await loadProfiles();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Organisation · RH"
        title="Personnel"
        description="Fiches du personnel, invitations et suivi RH."
        actions={
          <Button asChild>
            <Link href="/admin/personnel/nouveau">
              <Plus aria-hidden />
              Ajouter une personne
            </Link>
          </Button>
        }
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <PersonnelContent
          profiles={loaded.profiles}
          role={role}
          q={q}
          filtre={filtre}
          ficheId={ficheId}
        />
      )}
    </main>
  );
}

async function PersonnelContent({
  profiles,
  role,
  q,
  filtre,
  ficheId,
}: {
  profiles: Profile[];
  role: Role;
  q: string;
  filtre: FilterKey;
  ficheId?: string;
}) {
  const count = (statuses: readonly StaffStatus[]) =>
    profiles.filter((p) => statuses.includes(statusOf(p))).length;

  const stats = [
    {
      label: "Personnel",
      value: count(["actif", "invite", "inactif"]),
      hint: "hors fiches archivées",
    },
    { label: "Comptes actifs", value: count(["actif"]), hint: null },
    {
      label: "Invitations en attente",
      value: count(["invite"]),
      hint: "compte pas encore activé",
    },
    { label: "Inactifs", value: count(["inactif"]), hint: "accès coupé" },
  ];

  const statuses = FILTERS.find((f) => f.key === filtre)?.statuses ?? null;
  const needle = normalize(q);
  const visible = profiles.filter(
    (p) =>
      (!statuses ||
        (statuses as readonly StaffStatus[]).includes(statusOf(p))) &&
      (!needle ||
        normalize(`${p.full_name} ${p.email} ${p.job_title ?? ""}`).includes(
          needle,
        )),
  );

  const selected = ficheId ? profiles.find((p) => p.id === ficheId) : undefined;

  return (
    <>
      <section aria-label="Chiffres clés">
        <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <Card className="flex h-full flex-col gap-1 p-4 lg:p-5">
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p className="font-heading text-3xl font-extrabold tabular-nums">
                  {stat.value}
                </p>
                {stat.hint && (
                  <p className="text-muted-foreground text-xs">{stat.hint}</p>
                )}
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Annuaire : caché sur téléphone quand une fiche est ouverte */}
        <Card
          className={cn(
            "flex flex-col gap-4 p-4 lg:p-5",
            selected && "hidden lg:flex",
          )}
        >
          <h2 className="text-lg font-semibold">Annuaire</h2>

          <form role="search" action="/admin/personnel" className="relative">
            {filtre !== "tous" && (
              <input type="hidden" name="filtre" value={filtre} />
            )}
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <label htmlFor="q" className="sr-only">
              Rechercher
            </label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Nom, e-mail, spécialité…"
              className="pl-9"
            />
          </form>

          <nav
            aria-label="Filtrer par statut"
            className="bg-muted grid grid-cols-4 gap-1 rounded-lg p-1"
          >
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={personnelHref({ q, filtre: f.key })}
                aria-current={f.key === filtre ? "page" : undefined}
                className={cn(
                  "rounded-md px-1 py-2 text-center text-sm font-medium transition-colors",
                  f.key === filtre
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {profiles.length === 0
                ? "Aucune fiche pour le moment. Ajoutez la première personne."
                : "Aucune personne ne correspond à cette recherche."}
            </p>
          ) : (
            <Stagger as="ul" className="-mx-1 flex flex-col gap-1">
              {visible.map((profile) => {
                const status = statusOf(profile);
                const active = profile.id === selected?.id;
                return (
                  <StaggerItem as="li" key={profile.id}>
                    <Link
                      href={personnelHref({ q, filtre, fiche: profile.id })}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                        active
                          ? "border-primary bg-accent"
                          : "hover:bg-muted border-transparent",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground",
                        )}
                      >
                        {initials(profile.full_name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {profile.full_name}
                        </span>
                        <span className="text-muted-foreground block truncate text-sm">
                          {profile.job_title ?? ROLE_LABELS[profile.role]}
                        </span>
                      </span>
                      <Badge variant={STATUS_BADGE[status]}>
                        {status === "invite" ? "Invité" : STATUS_LABELS[status]}
                      </Badge>
                    </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </Card>

        {selected ? (
          <StaffDetail
            profile={selected}
            canManage={assignableRoles(role).includes(selected.role)}
            backHref={personnelHref({ q, filtre })}
          />
        ) : (
          <Card className="text-muted-foreground hidden items-center justify-center p-10 text-center lg:flex">
            {ficheId
              ? "Cette fiche est introuvable."
              : "Sélectionnez une personne dans l'annuaire pour afficher sa fiche."}
          </Card>
        )}
      </div>
    </>
  );
}

/** Fiche détaillée d'une personne (panneau de droite). */
async function StaffDetail({
  profile,
  canManage,
  backHref,
}: {
  profile: Profile;
  canManage: boolean;
  backHref: string;
}) {
  const status = statusOf(profile);
  const supabase = await createServerSupabase();
  const [{ data: note }, { data: documentRows }] = await Promise.all([
    supabase
      .from("staff_notes")
      .select("content")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase
      .from("staff_documents")
      .select("id, kind, file_name, size_bytes, storage_path, created_at")
      .eq("profile_id", profile.id)
      .eq("status", "actif"),
  ]);

  const documents: CurrentDocument[] = (documentRows ?? []).flatMap((doc) =>
    isDocumentKind(doc.kind)
      ? [
          {
            id: doc.id,
            kind: doc.kind,
            fileName: doc.file_name,
            sizeBytes: doc.size_bytes,
            uploadedOn: formatDate(doc.created_at),
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
    { label: "Contrat", value: contract ?? "Non renseigné" },
    {
      label: "Date d'arrivée",
      value: profile.hire_date
        ? formatDate(profile.hire_date)
        : "Non renseignée",
    },
    { label: "Fiche créée le", value: formatDate(profile.created_at) },
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-4 border-b p-4 sm:p-6">
        <Link
          href={backHref}
          className="text-primary flex items-center gap-1 text-sm font-medium lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à l&apos;annuaire
        </Link>

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
            <p className="text-muted-foreground">
              {[profile.job_title ?? "Spécialité non renseignée", contract]
                .filter(Boolean)
                .join(" · ")}
            </p>
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

        <DocumentsPanel profileId={profile.id} documents={documents} />

        <section className="border-t pt-6">
          <NoteForm profileId={profile.id} initial={note?.content ?? ""} />
        </section>
      </div>
    </Card>
  );
}
