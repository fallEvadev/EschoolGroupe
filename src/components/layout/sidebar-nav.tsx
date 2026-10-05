"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/auth/roles";
import { sectionsForRole, type NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  sections: NavSection[];
  role: Role;
  /** Appelé après un clic sur un lien (ferme le menu sur téléphone). */
  onNavigate?: () => void;
};

/** Liste des liens de la barre latérale, filtrée selon le rôle. */
export function SidebarNav({ sections, role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-7">
      {sectionsForRole(sections, role).map((section) => (
        <div key={section.title ?? "principal"} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-2 text-xs font-semibold tracking-[0.12em] uppercase opacity-60">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            if (!item.available) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title={`Disponible au lot ${item.lot}`}
                  className="flex h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-[15px] font-medium opacity-45"
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                    Bientôt
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
