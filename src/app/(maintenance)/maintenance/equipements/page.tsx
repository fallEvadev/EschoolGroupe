import { Monitor } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { loadEquipment } from "@/lib/equipment-data";
import { machineKindLabel } from "@/lib/machines";

export const metadata = { title: "Équipements · E-School" };

export default async function EquipementsPage() {
  await requireSpace("maintenance");
  const loaded = await loadEquipment();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Équipements"
        description="Les machines de chaque école. L'inventaire est tenu par l'Admin Maintenance."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.schools.length === 0 ? (
        <Card className="text-muted-foreground p-4 text-sm sm:p-6">
          Aucune école pour le moment.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {loaded.schools.map((school) => (
            <Card key={school.id} className="flex flex-col gap-3 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{school.name}</h2>
                <Badge variant="neutral">
                  {school.machines.length} équipement
                  {school.machines.length > 1 ? "s" : ""}
                </Badge>
                {school.archived && <Badge variant="neutral">Archivée</Badge>}
              </div>

              {school.machines.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Aucun équipement enregistré dans cette école.
                </p>
              ) : (
                <ul className="divide-border divide-y rounded-xl border">
                  {school.machines.map((machine) => (
                    <li
                      key={machine.id}
                      className="flex items-center gap-3 p-3"
                    >
                      <span
                        aria-hidden
                        className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
                      >
                        <Monitor className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {machine.label}
                        </span>
                        <span className="text-muted-foreground block truncate text-sm">
                          {machineKindLabel(machine.kind)}
                          {machine.serialNumber &&
                            ` · N° ${machine.serialNumber}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
