"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/layout/notification-bell";
import { InstallButton } from "@/components/pwa/install-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FORMATEUR_NAV, MAINTENANCE_NAV } from "@/lib/navigation";
import { NOTIFICATIONS_PATH } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const MENUS = {
  formateur: FORMATEUR_NAV,
  maintenance: MAINTENANCE_NAV,
};

/**
 * Cadre des espaces formateur et maintenance.
 * Téléphone : en-tête simple et barre de navigation fixée en bas de l'écran.
 * Ordinateur (dès `md`) : la navigation passe dans l'en-tête, la barre du bas
 * disparaît et le contenu est centré sur une largeur confortable.
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
  // Les pages pas encore livrées ne sont pas affichées.
  const items = MENUS[space].filter((item) => item.available);
  const rootHref = items[0]?.href ?? "/";

  // La rubrique reste active dans ses sous-pages (ex. un rapport ouvert).
  const isActive = (href: string) =>
    pathname === href || (href !== rootHref && pathname.startsWith(`${href}/`));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="md:bg-card md:border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 md:h-[72px] md:px-8">
          <Brand className="text-foreground" />

          {/* Ordinateur : navigation dans l'en-tête */}
          <nav
            aria-label="Navigation principale"
            className="hidden flex-1 items-center gap-1 md:flex"
          >
            {items.map((item) => {
              const Icon = item.icon;
              const style =
                "flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium";
              return item.available ? (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    style,
                    "transition-colors",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title="Bientôt disponible"
                  className={cn(
                    style,
                    "text-muted-foreground cursor-not-allowed opacity-45",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </span>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <InstallButton />
            <ThemeToggle />
            {unreadCount !== undefined && (
              <NotificationBell
                initialCount={unreadCount}
                href={NOTIFICATIONS_PATH[space]}
              />
            )}
            <UserButton />
          </div>
        </div>
      </header>

      {/* pb-24 : laisse la place à la barre du bas (téléphone seulement) */}
      <div className="mx-auto w-full max-w-6xl flex-1 pb-24 md:pb-10">
        {children}
      </div>

      {/* Téléphone : barre de navigation fixée en bas */}
      <nav
        aria-label="Navigation principale"
        className="bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-2xl justify-around px-2 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const style =
              "flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-medium";

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
                    <Icon className="size-6" aria-hidden />
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title="Bientôt disponible"
                    className={cn(
                      style,
                      "text-muted-foreground cursor-not-allowed opacity-45",
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
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
