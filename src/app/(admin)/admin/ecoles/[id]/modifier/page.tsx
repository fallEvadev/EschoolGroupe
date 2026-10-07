import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

import { requirePedagogyManager } from "../../access";
import { SchoolForm } from "../../school-form";

export const metadata = { title: "Modifier une école · E-School Groupe" };

export default async function ModifierEcolePage({
  params,
}: PageProps<"/admin/ecoles/[id]/modifier">) {
  await requirePedagogyManager();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createServerSupabase();
  const { data: school } = await supabase
    .from("schools")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!school) notFound();

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <Link
        href={`/admin/ecoles?ecole=${school.id}`}
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à l&apos;école
      </Link>
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Modifier l'école"
        description={school.name}
      />
      <Card className="p-4 sm:p-6">
        <SchoolForm
          schoolId={school.id}
          initial={{
            name: school.name,
            address: school.address ?? "",
            latitude: school.latitude === null ? "" : String(school.latitude),
            longitude:
              school.longitude === null ? "" : String(school.longitude),
            radiusM: school.radius_m,
            lateToleranceMinutes: school.late_tolerance_minutes,
          }}
        />
      </Card>
    </main>
  );
}
