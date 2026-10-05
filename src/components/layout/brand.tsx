import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Marque provisoire. À remplacer par le vrai logo (SVG ou PNG léger)
 * dès qu'une version sur fond clair/transparent est fournie.
 */
/**
 * Grand logo sur carte blanche, en tête de la barre latérale (maquette
 * « Direction pédagogique »). Reproduit en CSS en attendant un fichier SVG.
 */
export function BrandCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col items-center gap-1 rounded-2xl px-4 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="bg-primary text-primary-foreground font-heading flex size-11 -skew-y-6 items-center justify-center rounded-md text-3xl font-bold shadow-md"
        >
          e
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-primary font-serif text-2xl font-bold tracking-tight">
            SCHOOL
          </span>
          <span className="font-heading text-navy text-xl font-extrabold">
            Group
          </span>
        </span>
      </div>
      <span className="text-muted-foreground text-[10px]">
        « La Solution pour l&apos;école sénégalaise »
      </span>
      <span className="sr-only">E-School Groupe</span>
    </div>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="font-heading leading-tight font-bold">
        E-School
        <span className="block text-xs font-semibold opacity-70">Group</span>
      </span>
    </div>
  );
}
