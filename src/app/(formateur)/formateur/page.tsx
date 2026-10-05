import { EspaceProvisoire } from "@/components/espace-provisoire";
import { requireSpace } from "@/lib/auth/guards";

export default async function FormateurPage() {
  const role = await requireSpace("formateur");
  return <EspaceProvisoire titre="Espace formateur" role={role} />;
}
