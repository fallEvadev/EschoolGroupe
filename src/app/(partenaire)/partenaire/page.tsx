import { EspaceProvisoire } from "@/components/espace-provisoire";
import { requireSpace } from "@/lib/auth/guards";

export default async function PartenairePage() {
  const role = await requireSpace("partenaire");
  return <EspaceProvisoire titre="Espace partenaire" role={role} />;
}
