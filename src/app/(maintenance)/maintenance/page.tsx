import { EspaceProvisoire } from "@/components/espace-provisoire";
import { requireSpace } from "@/lib/auth/guards";

export default async function MaintenancePage() {
  const role = await requireSpace("maintenance");
  return <EspaceProvisoire titre="Espace maintenance" role={role} />;
}
