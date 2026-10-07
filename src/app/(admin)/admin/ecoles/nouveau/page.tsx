import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DEFAULT_LATE_TOLERANCE_MINUTES } from "@/lib/schools";

import { requirePedagogyManager } from "../access";
import { SchoolForm } from "../school-form";

export const metadata = { title: "Ajouter une école · E-School Groupe" };

export default async function NouvelleEcolePage() {
  await requirePedagogyManager();

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <Link
        href="/admin/ecoles"
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Écoles
      </Link>
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Ajouter une école"
        description="Renseignez le nom et l'adresse de l'école. Vous ajouterez ensuite son directeur, ses créneaux et ses formateurs ; le directeur enregistrera lui-même la position de l'école."
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
