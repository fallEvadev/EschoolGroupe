import { MobileShell } from "@/components/layout/bottom-nav";
import { requireSpace } from "@/lib/auth/guards";
import { requireRulesAccepted } from "@/lib/internal-rules";

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("maintenance");
  // Tant que le règlement en vigueur n'est pas accepté : page d'acceptation.
  await requireRulesAccepted(role);
  return <MobileShell space="maintenance">{children}</MobileShell>;
}
