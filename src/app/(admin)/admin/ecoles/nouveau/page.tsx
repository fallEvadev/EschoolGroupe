import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  DEFAULT_LATE_TOLERANCE_MINUTES,
  DEFAULT_RADIUS_M,
} from "@/lib/schools";

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
        description="Renseignez l'école et sa position. Vous ajouterez ensuite ses créneaux, son directeur et ses formateurs."
      />
      <Card className="p-4 sm:p-6">
        <SchoolForm
          initial={{
            name: "",
            address: "",
            latitude: "",
            longitude: "",
            radiusM: DEFAULT_RADIUS_M,
            lateToleranceMinutes: DEFAULT_LATE_TOLERANCE_MINUTES,
          }}
        />
      </Card>
    </main>
  );
}
