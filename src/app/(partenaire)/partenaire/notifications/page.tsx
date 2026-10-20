import { PageHeader } from "@/components/layout/page-header";
import { NotificationList } from "@/components/notification-list";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { loadNotifications } from "@/lib/notifications-data";

export const metadata = { title: "Notifications · E-School" };

export default async function PartnerNotificationsPage() {
  await requireSpace("partenaire");
  const loaded = await loadNotifications();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Portail partenaire"
        title="Notifications"
        description="Les bilans de votre école qui viennent d'être publiés."
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
