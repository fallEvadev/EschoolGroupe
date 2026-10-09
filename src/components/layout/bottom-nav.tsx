"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/layout/notification-bell";
import { FORMATEUR_NAV, MAINTENANCE_NAV } from "@/lib/navigation";
import { NOTIFICATIONS_PATH } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const MENUS = {
  formateur: FORMATEUR_NAV,
  maintenance: MAINTENANCE_NAV,
};

/**
 * Cadre mobile des espaces formateur et maintenance :
 * en-tête simple et barre de navigation fixée en bas de l'écran.
 * Le menu est choisi ici (et non passé en prop) car les icônes
 * sont des fonctions, qui ne traversent pas la frontière serveur/client.
 */
export function MobileShell({
  space,
  unreadCount,
  children,
}: {
  space: keyof typeof MENUS;
  /** Notifications non lues au chargement ; absent : pas de cloche (espace sans notifications). */
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = MENUS[space];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <header className="flex h-16 items-center justify-between px-4">
        <Brand className="text-navy" />
        <div className="flex items-center gap-2">
          {unreadCount !== undefined && (
            <NotificationBell
              initialCount={unreadCount}
              href={NOTIFICATIONS_PATH.formateur}
            />
          )}
          <UserButton />
        </div>
      </header>

      {/* pb-24 : laisse la place à la barre du bas */}
      <div className="flex-1 pb-24">{children}</div>

      <nav
        aria-label="Navigation principale"
        className="bg-card fixed inset-x-0 bottom-0 z-40 border-t"
      >
        <ul className="mx-auto flex max-w-2xl justify-around px-2 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const style =
              "flex min-w-14 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium";

            return (
              <li key={item.href}>
                {item.available ? (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      style,
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title={`Disponible au lot ${item.lot}`}
                    className={cn(
                      style,
                      "text-muted-foreground cursor-not-allowed opacity-45",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
