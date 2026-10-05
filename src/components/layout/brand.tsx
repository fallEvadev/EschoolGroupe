import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Marque provisoire. À remplacer par le vrai logo (SVG ou PNG léger)
 * dès qu'une version sur fond clair/transparent est fournie.
 */
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
