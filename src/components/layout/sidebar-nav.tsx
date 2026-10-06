"use client";

import { LayoutGroup, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Role } from "@/lib/auth/roles";
import { sectionsForRole, type NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  sections: NavSection[];
  role: Role;
  /** Appelé après un clic sur un lien (ferme le menu sur téléphone). */
  onNavigate?: () => void;
};

/** Page active : le lien lui-même, ou l'une de ses sous-pages. */
function isActive(pathname: string, href: string, rootHref: string): boolean {
  if (pathname === href) return true;
  // La racine (« Tableau de bord ») n'englobe pas les autres rubriques.
  return href !== rootHref && pathname.startsWith(`${href}/`);
}

/** Liste des liens de la barre latérale, filtrée selon le rôle. */
export function SidebarNav({ sections, role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  // Un groupe par menu affiché (barre fixe et menu mobile) : le fond actif
  // glisse à l'intérieur de son propre menu seulement.
  const groupId = useId();
  const visible = sectionsForRole(sections, role);
  const rootHref = visible[0]?.items[0]?.href ?? "/";

  return (
    <LayoutGroup id={groupId}>
      <nav aria-label="Navigation principale" className="flex flex-col gap-7">
        {visible.map((section) => (
          <div
            key={section.title ?? "principal"}
            className="flex flex-col gap-1"
          >
            {section.title && (
              <p className="px-3 pb-2 text-xs font-semibold tracking-[0.12em] uppercase opacity-60">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;

              if (!item.available) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        aria-disabled="true"
                        className="focus-visible:ring-sidebar-accent flex h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-[15px] font-medium opacity-45 outline-none focus-visible:ring-2"
                      >
                        <Icon className="size-5 shrink-0" aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        <span className="bg-sidebar-hover rounded-full px-2 py-0.5 text-[10px] font-semibold">
                          Bientôt
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Disponible au lot {item.lot}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              const active = isActive(pathname, item.href, rootHref);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-sidebar-accent relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors outline-none focus-visible:ring-2",
                    active
                      ? "text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-hover hover:text-sidebar-strong",
                  )}
                >
                  {active && (
                    // Fond bleu de la rubrique active : il glisse d'un lien à
                    // l'autre quand on change de page.
                    <motion.span
                      layoutId="sidebar-active"
                      aria-hidden
                      className="bg-sidebar-accent absolute inset-0 rounded-xl shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <Icon className="relative size-5 shrink-0" aria-hidden />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );
}
