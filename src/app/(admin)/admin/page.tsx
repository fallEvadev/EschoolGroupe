import { EspaceProvisoire } from "@/components/espace-provisoire";
import { requireSpace } from "@/lib/auth/guards";

export default async function AdminPage() {
  const role = await requireSpace("admin");
  return <EspaceProvisoire titre="Espace administration" role={role} />;
}
