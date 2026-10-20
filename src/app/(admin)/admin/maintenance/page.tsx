import { PageHeader } from "@/components/layout/page-header";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { parseTicketFilter } from "@/lib/tickets";

import { requireMaintenanceManager } from "../parc/access";

import { CONFIG_ERROR, loadTeam, loadTickets } from "./tickets-data";

import { TicketsContent } from "./tickets-content";
export const metadata = { title: "Maintenance · E-School" };

export default async function MaintenancePage({
  searchParams,
}: PageProps<"/admin/maintenance">) {
  await requireMaintenanceManager();
  const params = await searchParams;
  const filter = parseTicketFilter(params.statut);
  const ecole = typeof params.ecole === "string" ? params.ecole : undefined;
  const ticketId =
    typeof params.ticket === "string" ? params.ticket : undefined;

  if (!isSupabaseConfigured()) {
    return (
      <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <PageHeader eyebrow="Maintenance" title="Tickets de pannes" />
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {CONFIG_ERROR}
        </p>
      </main>
    );
  }

  const supabase = await createServerSupabase();
  const [loaded, team] = await Promise.all([
    loadTickets(supabase),
    loadTeam(supabase),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Tickets de pannes"
        description="Les pannes signalées par les formateurs dans leurs rapports. Une machine déjà en panne regroupe ses signalements dans un seul ticket."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <TicketsContent
          loaded={loaded}
          team={team}
          filter={filter}
          ecole={ecole}
          ticketId={ticketId}
        />
      )}
    </main>
  );
}
