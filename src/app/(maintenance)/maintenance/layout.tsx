import { MobileShell } from "@/components/layout/bottom-nav";
import { requireSpace } from "@/lib/auth/guards";
import { requireRulesAccepted } from "@/lib/internal-rules";
import { NOTIFIED_ROLES } from "@/lib/notifications";
import { countUnread } from "@/lib/notifications-data";

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("maintenance");
  // Tant que le règlement en vigueur n'est pas accepté : page d'acceptation.
  await requireRulesAccepted(role);
  // Le maintenancier reçoit ses tickets affectés ; les administrateurs qui
  // passent par cet espace ont leur propre cloche dans l'espace admin.
  const unreadCount =
    role === "maintenancier" && NOTIFIED_ROLES.includes(role)
      ? await countUnread()
      : undefined;
  return (
    <MobileShell space="maintenance" unreadCount={unreadCount}>
      {children}
    </MobileShell>
  );
}
