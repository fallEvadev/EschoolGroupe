import { School } from "lucide-react";
import Link from "next/link";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { sortMachines } from "@/lib/machines";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { requireMaintenanceManager } from "./access";
import { MachinesPanel, type MachineView } from "./machines-panel";

export const metadata = { title: "Parc informatique · E-School Groupe" };

type SchoolItem = { id: string; name: string; archived: boolean };

const CONFIG_ERROR =
  "Le service n'est pas encore configuré. Contactez l'administrateur technique.";

/**
 * Écoles via la fonction `maintenance_schools` (nom et statut seulement) : la
 * maintenance ne lit pas la table `schools` (adresse, position GPS).
 */
async function loadSchools(): Promise<
  { schools: SchoolItem[] } | { error: string }
> {
  if (!isSupabaseConfigured()) return { error: CONFIG_ERROR };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("maintenance_schools");
  if (error) {
    return {
      error: describeSupabaseError("maintenance_schools", error).message,
    };
  }
  return {
    schools: data
      .map((s) => ({
        id: s.id,
        name: s.name,
        archived: s.status === "archive",
      }))
      .sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          a.name.localeCompare(b.name, "fr"),
      ),
  };
}

async function loadMachines(
  schoolId: string,
): Promise<{ machines: MachineView[] } | { error: string }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("machines")
    .select("id, label, kind, serial_number, status")
    .eq("school_id", schoolId)
    .limit(1000);
  if (error) return { error: describeSupabaseError("machines", error).message };
  return {
    machines: sortMachines(data).map((m) => ({
      id: m.id,
      label: m.label,
      kind: m.kind,
      serialNumber: m.serial_number,
      archived: m.status === "archive",
    })),
  };
}

export default async function ParcPage({
  searchParams,
}: PageProps<"/admin/parc">) {
  await requireMaintenanceManager();
  const params = await searchParams;
  const ecoleId = typeof params.ecole === "string" ? params.ecole : undefined;

  const loaded = await loadSchools();
  const selected =
    "schools" in loaded
      ? loaded.schools.find((s) => s.id === ecoleId)
      : undefined;
  const machinesResult = selected ? await loadMachines(selected.id) : undefined;

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Parc informatique"
        description="Inventaire des machines de chaque école. Les formateurs les choisissent dans leur rapport pour signaler une panne."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          {/* Liste des écoles : cachée sur téléphone quand une école est ouverte */}
          <Card
            className={cn(
              "flex flex-col gap-3 p-4 lg:p-5",
              selected && "hidden lg:flex",
            )}
          >
            <h2 className="text-lg font-semibold">
              Écoles ({loaded.schools.length})
            </h2>
            {loaded.schools.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Aucune école pour le moment. La Direction pédagogique les crée
                dans « Écoles ».
              </p>
            ) : (
              <ul className="-mx-1 flex flex-col gap-1">
                {loaded.schools.map((school) => {
                  const active = school.id === selected?.id;
                  return (
                    <li key={school.id}>
                      <Link
                        href={`/admin/parc?ecole=${school.id}`}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                          active
                            ? "border-primary bg-accent"
                            : "hover:bg-muted border-transparent",
                        )}
                      >
                        <School
                          className="text-accent-foreground size-5 shrink-0"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {school.name}
                        </span>
                        {school.archived && (
                          <Badge variant="neutral">Archivée</Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {selected && machinesResult ? (
            <div className="flex flex-col gap-3">
              <BackLink href="/admin/parc" className="lg:hidden">
                Retour aux écoles
              </BackLink>
              {"error" in machinesResult ? (
                <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
                  {machinesResult.error}
                </p>
              ) : (
                <MachinesPanel
                  schoolId={selected.id}
                  schoolName={selected.name}
                  machines={machinesResult.machines}
                  schoolArchived={selected.archived}
                />
              )}
            </div>
          ) : (
            <Card className="text-muted-foreground hidden items-center justify-center p-10 text-center lg:flex">
              {ecoleId
                ? "Cette école est introuvable."
                : "Sélectionnez une école pour afficher son parc."}
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
