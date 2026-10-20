import { notFound } from "next/navigation";
import { z } from "zod";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";

import { requirePedagogyManager } from "../../access";
import { SchoolForm } from "../../school-form";

export const metadata = { title: "Modifier une école · E-School" };

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
      <BackLink href={`/admin/ecoles?ecole=${school.id}`}>
        Retour à l&apos;école
      </BackLink>
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
            lateToleranceMinutes: school.late_tolerance_minutes,
          }}
        />
      </Card>
    </main>
  );
}
