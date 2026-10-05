"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Brand } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth/roles";
import { ADMIN_NAV } from "@/lib/navigation";

/**
 * Cadre de l'espace admin : barre latérale fixe sur grand écran,
 * menu coulissant sur téléphone (mobile d'abord).
 */
export function AdminShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Échap ferme le menu sur téléphone.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const sidebar = (
    <div className="bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col gap-8 p-4">
      <div className="flex items-center justify-between">
        <Brand className="text-white" />
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-white/10 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Fermer le menu"
        >
          <X />
        </Button>
      </div>
      <SidebarNav
        sections={ADMIN_NAV}
        role={role}
        onNavigate={() => setMenuOpen(false)}
      />
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Grand écran : barre fixe */}
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {/* Téléphone : menu coulissant */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer le menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative h-full w-64">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu />
          </Button>
          <span className="hidden text-sm font-semibold lg:block">
            Espace administration
          </span>
          <UserButton />
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
