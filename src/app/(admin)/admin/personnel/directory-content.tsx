import { Search } from "lucide-react";
import Link from "next/link";

import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assignableRoles, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import {
  initials,
  STATUS_BADGE,
  STATUS_LABELS,
  type StaffStatus,
} from "@/lib/staff";
import { cn } from "@/lib/utils";

import {
  Profile,
  FILTERS,
  FilterKey,
  normalize,
  statusOf,
  personnelHref,
} from "./directory";
import { StaffDetail } from "./staff-detail";

export async function PersonnelContent({
  profiles,
  pendingProfileIds,
  role,
  q,
  filtre,
  docsFilter,
  ficheId,
  currentUserId,
}: {
  profiles: Profile[];
  pendingProfileIds: string[];
  role: Role;
  q: string;
  filtre: FilterKey;
  docsFilter: boolean;
  ficheId?: string;
  currentUserId: string | null;
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
  const pending = new Set(pendingProfileIds);
  const visible = profiles.filter(
    (p) =>
      (!statuses ||
        (statuses as readonly StaffStatus[]).includes(statusOf(p))) &&
      (!docsFilter || pending.has(p.id)) &&
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
            {docsFilter && (
              <input type="hidden" name="docs" value="a-verifier" />
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
                href={personnelHref({ q, filtre: f.key, docs: docsFilter })}
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

          <Link
            href={personnelHref({ q, filtre, docs: !docsFilter })}
            aria-pressed={docsFilter}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              docsFilter
                ? "border-primary bg-accent text-accent-foreground"
                : "hover:bg-muted",
            )}
          >
            <span>Pièces à vérifier</span>
            <Badge variant={pending.size > 0 ? "warning" : "neutral"}>
              {pending.size}
            </Badge>
          </Link>

          {visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {profiles.length === 0
                ? "Aucune fiche pour le moment. Ajoutez la première personne."
                : docsFilter && !needle
                  ? "Aucune pièce en attente de contrôle."
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
                      href={personnelHref({
                        q,
                        filtre,
                        docs: docsFilter,
                        fiche: profile.id,
                      })}
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
            isSelf={selected.clerk_user_id === currentUserId}
            backHref={personnelHref({ q, filtre, docs: docsFilter })}
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
