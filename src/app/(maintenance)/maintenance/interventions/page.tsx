import { PageHeader } from "@/components/layout/page-header";
import { TicketList } from "@/components/ticket-list";
import { requireSpace } from "@/lib/auth/guards";
import { loadMyTickets } from "@/lib/maintenance-data";
import { sortTickets } from "@/lib/tickets";

export const metadata = { title: "Interventions · E-School Groupe" };

export default async function InterventionsPage() {
  await requireSpace("maintenance");
  const loaded = await loadMyTickets(["resolu"]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Interventions"
        description="L'historique de vos tickets résolus."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <TicketList
          tickets={sortTickets(loaded.tickets)}
          empty="Aucune intervention terminée pour le moment."
        />
      )}
    </main>
  );
}
