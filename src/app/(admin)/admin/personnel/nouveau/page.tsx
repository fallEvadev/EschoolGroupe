import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { assignableRoles } from "@/lib/auth/roles";

import { requireStaffManager } from "../access";
import { StaffForm } from "../staff-form";

export const metadata = { title: "Ajouter une personne · E-School Groupe" };

export default async function NouvellePersonnePage() {
  const role = await requireStaffManager();

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <Link
        href="/admin/personnel"
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Personnel
      </Link>
      <PageHeader
        eyebrow="Organisation · RH"
        title="Ajouter une personne"
        description="La fiche est créée immédiatement. La personne reçoit ensuite un e-mail pour activer son compte et choisir son mot de passe."
      />
      <Card className="p-4 sm:p-6">
        <StaffForm
          roles={assignableRoles(role)}
          initial={{
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            role: "formateur",
            jobTitle: "",
            contractType: "",
            hireDate: "",
          }}
        />
      </Card>
    </main>
  );
}
