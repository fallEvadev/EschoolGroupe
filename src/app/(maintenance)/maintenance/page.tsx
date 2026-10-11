import { PageHeader } from "@/components/layout/page-header";
import { TicketList } from "@/components/ticket-list";
import { requireSpace } from "@/lib/auth/guards";
import { loadMyTickets } from "@/lib/maintenance-data";
import { sortTickets } from "@/lib/tickets";

export const metadata = { title: "Mes tickets · E-School Groupe" };

export default async function MaintenancePage() {
  await requireSpace("maintenance");
  const loaded = await loadMyTickets(["ouvert", "en_cours"]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Mes tickets"
        description="Les pannes qui vous sont confiées, les plus anciennes en premier."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <TicketList
          tickets={sortTickets(loaded.tickets)}
          empty="Aucun ticket à traiter pour le moment. L'Admin Maintenance vous en affecte dès qu'une panne est signalée."
        />
      )}
    </main>
  );
}
