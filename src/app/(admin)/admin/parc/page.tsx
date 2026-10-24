import { ChevronDown, School, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

import { requireMaintenanceManager } from "./access";
import { MachinesPanel, type MachineView } from "./machines-panel";

export const metadata = { title: "Parc informatique · E-School" };

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
type SchoolItem = { id: string; name: string; archived: boolean };

const CONFIG_ERROR =
  "Le service n'est pas encore configuré. Contactez l'administrateur technique.";

/** Supabase renvoie au plus 1 000 lignes par lecture : on lit par pages. */
const PAGE_SIZE = 1000;

/**
 * Écoles via la fonction `maintenance_schools` (nom et statut seulement) : la
 * maintenance ne lit pas la table `schools` (adresse, position GPS).
 */
async function loadSchools(
  supabase: ServerSupabase,
): Promise<{ schools: SchoolItem[] } | { error: string }> {
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

/** Toutes les machines, rangées par école. */
async function loadMachines(
  supabase: ServerSupabase,
): Promise<{ bySchool: Map<string, MachineView[]> } | { error: string }> {
  const bySchool = new Map<string, MachineView[]>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("machines")
      .select("id, school_id, label, kind, serial_number, status")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return { error: describeSupabaseError("machines", error).message };
    }
    for (const row of data) {
      const list = bySchool.get(row.school_id) ?? [];
      list.push({
        id: row.id,
        label: row.label,
        kind: row.kind,
        serialNumber: row.serial_number,
        archived: row.status === "archive",
      });
      bySchool.set(row.school_id, list);
    }
    if (data.length < PAGE_SIZE) break;
  }
  for (const [schoolId, list] of bySchool) {
    // `sortMachines` attend les champs de la base ; on trie sur le nom et l'état.
    bySchool.set(
      schoolId,
      [...list].sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          a.label.localeCompare(b.label, "fr", { numeric: true }),
      ),
    );
  }
  return { bySchool };
}

/** Nombre de pannes en cours (ouvertes ou en cours de traitement) par école. */
async function loadPanneCounts(
  supabase: ServerSupabase,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select("school_id")
    .in("status", ["ouvert", "en_cours"])
    .limit(PAGE_SIZE);
  const counts = new Map<string, number>();
  // Le nombre de pannes est un confort : une erreur ne bloque pas la page.
  if (error) return counts;
  for (const row of data) {
    counts.set(row.school_id, (counts.get(row.school_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Parc informatique : toutes les écoles sur une seule page, sans rien à
 * « afficher ». Chaque école montre combien de pannes sont en cours (lien vers
 * les tickets), sa liste de machines et une ligne d'ajout. L'inventaire est
 * facultatif : sans lui, le formateur écrit le nom du matériel en panne.
 */
export default async function ParcPage() {
  await requireMaintenanceManager();

  let content: React.ReactNode;
  if (!isSupabaseConfigured()) {
    content = <Warning>{CONFIG_ERROR}</Warning>;
  } else {
    const supabase = await createServerSupabase();
    const [schools, machines, panneCounts] = await Promise.all([
      loadSchools(supabase),
      loadMachines(supabase),
      loadPanneCounts(supabase),
    ]);

    if ("error" in schools) {
      content = <Warning>{schools.error}</Warning>;
    } else if ("error" in machines) {
      content = <Warning>{machines.error}</Warning>;
    } else if (schools.schools.length === 0) {
      content = (
        <Card className="text-muted-foreground p-6 text-center text-sm">
          Aucune école pour le moment. La Direction pédagogique les crée dans
          « Écoles ».
        </Card>
      );
    } else {
      const few = schools.schools.length <= 2;
      content = (
        <ul className="flex flex-col gap-3">
          {schools.schools.map((school) => {
            const list = machines.bySchool.get(school.id) ?? [];
            const active = list.filter((m) => !m.archived).length;
            const pannes = panneCounts.get(school.id) ?? 0;
            return (
              <li key={school.id}>
                <Card className="p-0">
                  <details className="group" open={few || pannes > 0}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                      <School
                        className="text-accent-foreground size-5 shrink-0"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {school.name}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {active === 0
                            ? "Aucune machine enregistrée"
                            : `${active} machine${active > 1 ? "s" : ""}`}
                        </span>
                      </span>
                      {school.archived && (
                        <Badge variant="neutral">Archivée</Badge>
                      )}
                      {pannes > 0 && (
                        <Badge variant="warning">
                          <TriangleAlert className="size-3" aria-hidden />
                          {pannes} panne{pannes > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <ChevronDown
                        className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <div className="flex flex-col gap-4 border-t p-4">
                      {pannes > 0 && (
                        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
                          {pannes} panne{pannes > 1 ? "s" : ""} en cours dans
                          cette école.{" "}
                          <Link
                            href={`/admin/maintenance?ecole=${school.id}`}
                            className="font-semibold underline"
                          >
                            Voir les tickets
                          </Link>
                        </p>
                      )}
                      <MachinesPanel
                        schoolId={school.id}
                        machines={list}
                        schoolArchived={school.archived}
                      />
                    </div>
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
      );
    }
  }

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Parc informatique"
        description="Les machines de chaque école. C'est facultatif : avec une liste, le formateur choisit la machine en panne dans son rapport ; sans liste, il écrit le nom du matériel. Les pannes signalées se suivent dans « Tickets de pannes »."
      />
      {content}
    </main>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
      {children}
    </p>
  );
}
