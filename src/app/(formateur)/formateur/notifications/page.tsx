import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { loadNotifications } from "@/lib/notifications-data";

import { NotificationList } from "@/components/notification-list";

export const metadata = { title: "Notifications · E-School Groupe" };

export default async function NotificationsPage() {
  await requireSpace("formateur");
  const loaded = await loadNotifications();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <BackLink href="/formateur">Accueil</BackLink>
      <PageHeader
        eyebrow="Espace formateur"
        title="Notifications"
        description="Les décisions de la Direction sur vos rapports."
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
