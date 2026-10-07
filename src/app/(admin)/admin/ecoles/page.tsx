import { ArrowLeft, MapPin, Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mapsUrl } from "@/lib/schools";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

import { loadStaffDirectory, requirePedagogyManager } from "./access";
import { DirectorsPanel, type PersonOption } from "./directors-panel";
import { SchoolStatusButton } from "./school-status-button";
import { SlotsPanel, type SlotView } from "./slots-panel";

export const metadata = { title: "Écoles · E-School Groupe" };

type School = Tables<"schools">;

async function loadSchools(): Promise<
  { schools: School[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  // Client avec le jeton de l'utilisateur : la RLS réserve l'écriture à la
  // Direction pédagogique et limite la lecture selon le rôle.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .order("name")
    .limit(500);
  if (error) return { error: describeSupabaseError("schools", error).message };
  // Écoles actives d'abord, archivées à la fin.
  return {
    schools: [...data].sort(
      (a, b) =>
        Number(a.status === "archive") - Number(b.status === "archive") ||
        a.name.localeCompare(b.name, "fr"),
    ),
  };
}

export default async function EcolesPage({
  searchParams,
}: PageProps<"/admin/ecoles">) {
  await requirePedagogyManager();
  const params = await searchParams;
  const ecoleId = typeof params.ecole === "string" ? params.ecole : undefined;

  const loaded = await loadSchools();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Écoles"
        description="Écoles partenaires, leur position pour le pointage, leurs créneaux, leurs directeurs et les formateurs affectés."
        actions={
          <Button asChild>
            <Link href="/admin/ecoles/nouveau">
              <Plus aria-hidden />
              Ajouter une école
            </Link>
          </Button>
        }
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <SchoolsContent schools={loaded.schools} ecoleId={ecoleId} />
      )}
    </main>
  );
}

function SchoolsContent({
  schools,
  ecoleId,
}: {
  schools: School[];
  ecoleId?: string;
}) {
  const selected = ecoleId ? schools.find((s) => s.id === ecoleId) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      {/* Liste : cachée sur téléphone quand une école est ouverte */}
      <Card
        className={cn(
          "flex flex-col gap-4 p-4 lg:p-5",
          selected && "hidden lg:flex",
        )}
      >
        <h2 className="text-lg font-semibold">Écoles ({schools.length})</h2>

        {schools.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Aucune école pour le moment. Ajoutez la première.
          </p>
        ) : (
          <Stagger as="ul" className="-mx-1 flex flex-col gap-1">
            {schools.map((school) => {
              const active = school.id === selected?.id;
              const hasPosition =
                school.latitude !== null && school.longitude !== null;
              return (
                <StaggerItem as="li" key={school.id}>
                  <Link
                    href={`/admin/ecoles?ecole=${school.id}`}
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
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground",
                      )}
                    >
                      <MapPin className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {school.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-sm">
                        {school.address ?? "Adresse non renseignée"}
                      </span>
                    </span>
                    {school.status === "archive" ? (
                      <Badge variant="neutral">Archivée</Badge>
                    ) : !hasPosition ? (
                      <Badge variant="warning">Sans position</Badge>
                    ) : null}
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </Card>

      {selected ? (
        <SchoolDetail school={selected} backHref="/admin/ecoles" />
      ) : (
        <Card className="text-muted-foreground hidden items-center justify-center p-10 text-center lg:flex">
          {ecoleId
            ? "Cette école est introuvable."
            : "Sélectionnez une école dans la liste pour afficher sa fiche."}
        </Card>
      )}
    </div>
  );
}

/** Fiche détaillée d'une école (panneau de droite). */
async function SchoolDetail({
  school,
  backHref,
}: {
  school: School;
  backHref: string;
}) {
  const archived = school.status === "archive";
  const supabase = await createServerSupabase();

  const [directory, directorsResult, slotsResult] = await Promise.all([
    loadStaffDirectory(supabase),
    supabase
      .from("school_directors")
      .select("profile_id")
      .eq("school_id", school.id)
      .eq("status", "actif"),
    supabase
      .from("time_slots")
      .select("id, weekday, starts_at, ends_at, label")
      .eq("school_id", school.id)
      .eq("status", "actif")
      .order("weekday")
      .order("starts_at"),
  ]);

  const slotRows = slotsResult.data ?? [];
  const slotIds = slotRows.map((slot) => slot.id);
  const assignmentRows =
    slotIds.length === 0
      ? []
      : ((
          await supabase
            .from("slot_assignments")
            .select("id, slot_id, profile_id")
            .in("slot_id", slotIds)
            .eq("status", "actif")
        ).data ?? []);

  const hasPosition = school.latitude !== null && school.longitude !== null;

  // Noms et listes de choix : annuaire minimal (nom, rôle, statut).
  let directors: PersonOption[] = [];
  let candidates: PersonOption[] = [];
  let formateurs: PersonOption[] = [];
  let names = new Map<string, string>();
  if (!("error" in directory)) {
    names = new Map(directory.staff.map((p) => [p.id, p.fullName]));
    const linked = new Set(
      (directorsResult.data ?? []).map((row) => row.profile_id),
    );
    directors = [...linked].map((id) => ({
      id,
      name: names.get(id) ?? "Compte inconnu",
    }));
    candidates = directory.staff
      .filter(
        (p) =>
          p.role === "directeur_partenaire" &&
          p.status === "actif" &&
          !linked.has(p.id),
      )
      .map((p) => ({ id: p.id, name: p.fullName }));
    formateurs = directory.staff
      .filter((p) => p.role === "formateur" && p.status === "actif")
      .map((p) => ({ id: p.id, name: p.fullName }));
  }

  const slots: SlotView[] = slotRows.map((slot) => ({
    id: slot.id,
    weekday: slot.weekday,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    label: slot.label,
    assignments: assignmentRows
      .filter((assignment) => assignment.slot_id === slot.id)
      .map((assignment) => ({
        id: assignment.id,
        profileId: assignment.profile_id,
        name: names.get(assignment.profile_id) ?? "Compte inconnu",
      })),
  }));

  const infos: { label: string; value: React.ReactNode }[] = [
    { label: "Adresse", value: school.address ?? "Non renseignée" },
    {
      label: "Position",
      value: hasPosition ? (
        <>
          {school.latitude}, {school.longitude}{" "}
          <a
            href={mapsUrl(school.latitude!, school.longitude!)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm font-medium hover:underline"
          >
            Voir sur la carte
          </a>
        </>
      ) : (
        <span className="text-warning">
          Non renseignée : la géolocalisation ne pourra pas être vérifiée.
        </span>
      ),
    },
    { label: "Rayon autorisé", value: `${school.radius_m} m` },
    {
      label: "Tolérance de retard",
      value: `${school.late_tolerance_minutes} min`,
    },
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-4 border-b p-4 sm:p-6">
        <Link
          href={backHref}
          className="text-primary flex items-center gap-1 text-sm font-medium lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour aux écoles
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-2xl font-bold break-words">{school.name}</h2>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={archived ? "neutral" : "success"}>
                {archived ? "Archivée" : "Active"}
              </Badge>
              {!hasPosition && !archived && (
                <Badge variant="warning">Sans position</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/admin/ecoles/${school.id}/modifier`}>
                Modifier l&apos;école
              </Link>
            </Button>
            <SchoolStatusButton
              schoolId={school.id}
              schoolName={school.name}
              archived={archived}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
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

        {"error" in directory ? (
          <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
            {directory.error}
          </p>
        ) : (
          <>
            <DirectorsPanel
              schoolId={school.id}
              directors={directors}
              candidates={candidates}
              disabled={archived}
            />
            <SlotsPanel
              schoolId={school.id}
              slots={slots}
              formateurs={formateurs}
              disabled={archived}
            />
          </>
        )}
      </div>
    </Card>
  );
}
