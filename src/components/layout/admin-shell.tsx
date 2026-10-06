"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { useState } from "react";

import { BrandCard } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { ADMIN_NAV } from "@/lib/navigation";
import { initials } from "@/lib/staff";

export type AdminShellProps = {
  role: Role;
  userName: string;
  organizationName: string;
  /** Année et semestre en cours (absents tant que la base n'est pas prête). */
  period: { academicYear: string; currentSemester: number } | null;
  /** Date du jour déjà formatée côté serveur (ex. « lundi 5 octobre »). */
  today: string;
  children: React.ReactNode;
};

/**
 * Cadre de l'espace admin (maquette « Direction pédagogique ») :
 * barre latérale fixe sur grand écran, menu coulissant sur téléphone.
 */
export function AdminShell({
  role,
  userName,
  organizationName,
  period,
  today,
  children,
}: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const sidebar = (
    <div className="bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col gap-6 overflow-y-auto p-4">
      <div className="flex flex-col gap-3">
        <BrandCard />
        <p className="text-sidebar-strong/85 px-1 text-sm font-medium">
          {organizationName} · Administration
        </p>
      </div>

      <SidebarNav
        sections={ADMIN_NAV}
        role={role}
        onNavigate={() => setMenuOpen(false)}
      />

      <div className="bg-sidebar-surface mt-auto flex items-center gap-3 rounded-xl px-3 py-3">
        <span className="bg-success size-2 shrink-0 rounded-full" aria-hidden />
        <span className="text-sidebar-strong min-w-0 flex-1 truncate text-sm font-medium">
          {ROLE_LABELS[role]}
        </span>
        <span className="text-success-soft text-xs font-semibold">
          Connecté
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Grand écran : barre fixe */}
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {/* Téléphone : menu coulissant (focus gardé dans le menu, Échap ferme) */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="[&>button]:text-foreground w-64 border-none p-0 sm:max-w-64 [&>button]:top-6 [&>button]:right-6"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigation de l&apos;espace administration
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 sm:px-8 lg:h-20">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu />
          </Button>
          <span className="font-heading truncate font-semibold lg:hidden">
            {organizationName}
          </span>

          <div className="ml-auto flex items-center gap-4">
            {period && (
              <>
                <div className="hidden text-right md:block">
                  <p className="font-heading text-sm font-bold">
                    Année {period.academicYear}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Semestre {period.currentSemester} · {today}
                  </p>
                </div>
                <span
                  className="bg-border hidden h-10 w-px md:block"
                  aria-hidden
                />
              </>
            )}

            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-accent text-accent-foreground hidden size-10 items-center justify-center rounded-full text-sm font-bold sm:flex"
              >
                {initials(userName)}
              </span>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {ROLE_LABELS[role]}
                </p>
              </div>
              <UserButton />
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
