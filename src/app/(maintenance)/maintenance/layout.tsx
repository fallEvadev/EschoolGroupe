import { MobileShell } from "@/components/layout/bottom-nav";
import { requireSpace } from "@/lib/auth/guards";

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSpace("maintenance");
  return <MobileShell space="maintenance">{children}</MobileShell>;
}
