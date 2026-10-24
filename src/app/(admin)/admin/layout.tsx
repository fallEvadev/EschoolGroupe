import { currentUser } from "@clerk/nextjs/server";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireSpace } from "@/lib/auth/guards";
import { formatLongDate } from "@/lib/dates";
import { NOTIFIED_ROLES } from "@/lib/notifications";
import { countUnread } from "@/lib/notifications-data";
import { getOrganizationSettings } from "@/lib/organization";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("admin");
  // La Direction pédagogique (rapports envoyés) et l'Admin Maintenance (nouvelles
  // pannes) reçoivent des notifications. Tout est lu en même temps.
  const [user, settings, unreadCount] = await Promise.all([
    currentUser(),
    getOrganizationSettings(),
    NOTIFIED_ROLES.includes(role) ? countUnread() : Promise.resolve(undefined),
  ]);

  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Utilisateur";

  return (
    <AdminShell
      role={role}
      userName={userName}
      organizationName={settings?.organizationName ?? "E-School"}
      period={settings}
      today={formatLongDate(new Date())}
      unreadCount={unreadCount}
    >
      {children}
    </AdminShell>
  );
}
