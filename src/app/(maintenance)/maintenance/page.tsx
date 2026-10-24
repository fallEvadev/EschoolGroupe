import { PageHeader } from "@/components/layout/page-header";
import { PanneList } from "@/components/panne-list";
import { requireSpace } from "@/lib/auth/guards";
import { loadMyTickets } from "@/lib/maintenance-data";

export const metadata = { title: "Pannes · E-School" };

export default async function MaintenancePage() {
  await requireSpace("maintenance");
  const loaded = await loadMyTickets(["ouvert", "en_cours"]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Maintenance"
        title="Pannes signalées"
        description="Les pannes de toutes les écoles, classées par école. Appuyez sur « Bien reçu » pour dire que vous vous en occupez : le formateur est prévenu."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <PanneList
          tickets={loaded.tickets}
          empty="Aucune panne à traiter pour le moment. Vous serez prévenu dès qu'un formateur en signale une."
        />
      )}
    </main>
  );
}
