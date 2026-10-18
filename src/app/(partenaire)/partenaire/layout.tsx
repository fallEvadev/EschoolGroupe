import { UserButton } from "@clerk/nextjs";

import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { requireSpace } from "@/lib/auth/guards";
import { NOTIFICATIONS_PATH, NOTIFIED_ROLES } from "@/lib/notifications";
import { countUnread } from "@/lib/notifications-data";

import { PartnerNav } from "./partner-nav";

/** Portail partenaire : lecture seule, en-tête simple avec la cloche et le menu. */
export default async function PartenaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("partenaire");
  // Le directeur est prévenu quand un bilan de son école est publié.
  const unreadCount = NOTIFIED_ROLES.includes(role)
    ? await countUnread()
    : undefined;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <header className="flex h-16 items-center justify-between px-4">
        <Brand className="text-foreground" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {unreadCount !== undefined && (
            <NotificationBell
              initialCount={unreadCount}
              href={NOTIFICATIONS_PATH.partenaire}
            />
          )}
          <UserButton />
        </div>
      </header>
      <PartnerNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
