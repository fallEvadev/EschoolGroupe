import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Lien de retour en haut de page. Zone tactile d'au moins 44 px de haut et
 * flèche bien visible : sur téléphone, c'est le geste de retour le plus utilisé.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-primary focus-visible:ring-ring -ml-2 flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-base font-medium focus-visible:ring-2 focus-visible:outline-none md:text-sm",
        className,
      )}
    >
      <ArrowLeft className="size-5 md:size-4" aria-hidden />
      {children}
    </Link>
  );
}
