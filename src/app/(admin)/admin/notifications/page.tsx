import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/notification-list";
import { Card } from "@/components/ui/card";
import { loadNotifications } from "@/lib/notifications-data";

import { requireSpace } from "@/lib/auth/guards";
import { NOTIFIED_ROLES } from "@/lib/notifications";

export const metadata = { title: "Notifications · E-School" };

export default async function AdminNotificationsPage() {
  const role = await requireSpace("admin");
  // Second verrou : seuls les rôles notifiés de l'espace admin (le premier est dans proxy.ts).
  if (!NOTIFIED_ROLES.includes(role)) redirect("/non-autorise");
  const loaded = await loadNotifications();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Administration"
        title="Notifications"
        description="Les rapports à traiter et les nouvelles pannes à suivre."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.items.length === 0 ? (
        <Card className="text-muted-foreground p-4 text-sm sm:p-6">
          Aucune notification pour le moment.
        </Card>
      ) : (
        <NotificationList items={loaded.items} />
      )}
    </main>
  );
}
