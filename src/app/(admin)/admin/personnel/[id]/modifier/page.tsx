import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { assignableRoles } from "@/lib/auth/roles";
import { isContractType, splitFullName } from "@/lib/staff";
import { createServerSupabase } from "@/lib/supabase/server";

import { requireStaffManager } from "../../access";
import { StaffForm } from "../../staff-form";

export const metadata = { title: "Modifier une fiche · E-School Groupe" };

export default async function ModifierPersonnePage({
  params,
}: PageProps<"/admin/personnel/[id]/modifier">) {
  const role = await requireStaffManager();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const ficheHref = `/admin/personnel?fiche=${profile.id}`;
  const roles = assignableRoles(role);
  const { firstName, lastName } = splitFullName(profile.full_name);

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <Link
        href={ficheHref}
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la fiche
      </Link>
      <PageHeader
        eyebrow="Organisation · RH"
        title="Modifier la fiche"
        description={profile.full_name}
      />
      <Card className="p-4 sm:p-6">
        {roles.includes(profile.role) ? (
          <StaffForm
            profileId={profile.id}
            roles={roles}
            initial={{
              firstName,
              lastName,
              email: profile.email,
              phone: profile.phone ?? "",
              role: profile.role,
              jobTitle: profile.job_title ?? "",
              contractType:
                profile.contract_type && isContractType(profile.contract_type)
                  ? profile.contract_type
                  : "",
              hireDate: profile.hire_date ?? "",
            }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Les fiches des administrateurs sont gérées par le Super-Admin.
          </p>
        )}
      </Card>
    </main>
  );
}
