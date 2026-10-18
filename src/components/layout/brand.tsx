import { LogoMark } from "@/components/layout/logo-mark";
import { cn } from "@/lib/utils";

/**
 * Logo complet sur carte, en tête de la barre latérale : cube, « SCHOOL » en
 * bleu de marque, « Group » dans la couleur du texte, et la devise. Les textes
 * suivent le thème clair ou sombre.
 */
export function BrandCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col items-center gap-1.5 rounded-2xl px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <LogoMark className="size-11" />
        <span className="flex flex-col leading-none">
          <span className="text-primary font-serif text-2xl font-bold tracking-tight">
            SCHOOL
          </span>
          <span className="font-heading text-foreground text-lg font-extrabold">
            Group
          </span>
        </span>
      </div>
      <span className="text-muted-foreground text-center text-[10px] leading-tight">
        La Solution pour l&apos;école sénégalaise
      </span>
      <span className="sr-only">E-School Groupe</span>
    </div>
  );
}

/** Logo compact des en-têtes (téléphone) : cube et nom sur deux lignes. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-9" />
      <span className="font-heading leading-tight font-bold">
        <span className="text-primary">E-School</span>
        <span className="block text-xs font-semibold opacity-70">Group</span>
      </span>
    </div>
  );
}
