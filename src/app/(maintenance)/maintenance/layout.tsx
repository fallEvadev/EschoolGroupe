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
  // Le maintenancier reçoit ses tickets affectés ; les administrateurs qui
  // passent par cet espace ont leur propre cloche dans l'espace admin.
  // Les lectures partent ensemble ; tant que le règlement en vigueur n'est pas
  // accepté : page d'acceptation.
  const [, unreadCount] = await Promise.all([
    requireRulesAccepted(role),
    role === "maintenancier" && NOTIFIED_ROLES.includes(role)
      ? countUnread()
      : Promise.resolve(undefined),
  ]);
  return (
    <MobileShell space="maintenance" unreadCount={unreadCount}>
      {children}
    </MobileShell>
  );
}
