"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/partenaire", label: "Codes du jour" },
  { href: "/partenaire/bilans", label: "Bilans" },
] as const;

/** Menu du portail partenaire : deux pages, la page courante est soulignée. */
export function PartnerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation du portail" className="px-4 md:px-8">
      <ul className="flex gap-1 border-b">
        {LINKS.map((link) => {
          const active =
            link.href === "/partenaire"
              ? pathname === "/partenaire"
              : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-4 py-3 text-base font-medium md:text-sm",
                  active
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
