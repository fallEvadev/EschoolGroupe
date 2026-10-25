import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DEFAULT_LATE_TOLERANCE_MINUTES } from "@/lib/schools";

import { requirePedagogyManager } from "../access";
import { SchoolForm } from "../school-form";

export const metadata = { title: "Ajouter une école · E-School" };

export default async function NouvelleEcolePage() {
  await requirePedagogyManager();

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <BackLink href="/admin/ecoles">Écoles</BackLink>
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Ajouter une école"
        description="Renseignez le nom et l'adresse de l'école. Vous ajouterez ensuite son directeur, ses créneaux et ses formateurs, puis vous enregistrerez la position de l'école."
      />
      <Card className="p-4 sm:p-6">
        <SchoolForm
          initial={{
            name: "",
            address: "",
            lateToleranceMinutes: DEFAULT_LATE_TOLERANCE_MINUTES,
          }}
        />
      </Card>
    </main>
  );
}
