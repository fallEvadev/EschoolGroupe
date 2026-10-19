import "server-only";

import { sortMachines } from "@/lib/machines";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createServerSupabase } from "@/lib/supabase/server";

export type EquipmentSchool = {
  id: string;
  name: string;
  archived: boolean;
  machines: {
    id: string;
    label: string;
    kind: string;
    serialNumber: string | null;
  }[];
};

/**
 * Parc des écoles pour le maintenancier : les machines actives de chaque école.
 * Lu avec SON jeton (la RLS décide). Les écoles passent par la fonction
 * `maintenance_schools()` (nom et statut seulement), jamais par la table
 * `schools` (adresse, position GPS) qui ne lui est pas ouverte.
 */
export async function loadEquipment(): Promise<
  { schools: EquipmentSchool[] } | { error: string }
> {
  const supabase = await createServerSupabase();
  const [schoolsResult, machinesResult] = await Promise.all([
    supabase.rpc("maintenance_schools"),
    supabase
      .from("machines")
      .select("id, school_id, label, kind, serial_number, status")
      .eq("status", "actif")
      .limit(1000),
  ]);
  if (schoolsResult.error) {
    return {
      error: describeSupabaseError("maintenance_schools", schoolsResult.error)
        .message,
    };
  }
  if (machinesResult.error) {
    return {
      error: describeSupabaseError("machines", machinesResult.error).message,
    };
  }

  const bySchool = new Map<string, EquipmentSchool["machines"]>();
  for (const machine of sortMachines(
    machinesResult.data.map((m) => ({ ...m, status: m.status })),
  )) {
    const list = bySchool.get(machine.school_id) ?? [];
    list.push({
      id: machine.id,
      label: machine.label,
      kind: machine.kind,
      serialNumber: machine.serial_number,
    });
    bySchool.set(machine.school_id, list);
  }

  return {
    schools: schoolsResult.data
      .map((school) => ({
        id: school.id,
        name: school.name,
        archived: school.status === "archive",
        machines: bySchool.get(school.id) ?? [],
      }))
      // Une école archivée sans machine n'apporte rien à l'inventaire.
      .filter((school) => !school.archived || school.machines.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
  };
}
