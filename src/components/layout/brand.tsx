import { LogoMark } from "@/components/layout/logo-mark";
import { cn } from "@/lib/utils";

/**
 * Logo complet sur carte, en tête de la barre latérale : cube, « E-School » en
 * bleu de marque et la devise. Les textes suivent le thème clair ou sombre.
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
        <span className="text-primary font-serif text-2xl leading-none font-bold tracking-tight">
          E-School
        </span>
      </div>
      <span className="text-muted-foreground text-center text-[10px] leading-tight">
        La Solution pour l&apos;école sénégalaise
      </span>
    </div>
  );
}

/** Logo compact des en-têtes : cube et nom. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-9" />
      <span className="font-heading text-primary leading-tight font-bold">
        E-School
      </span>
    </div>
  );
}
