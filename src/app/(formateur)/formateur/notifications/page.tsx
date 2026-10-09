import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
      <Link
        href="/formateur"
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Accueil
      </Link>
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
