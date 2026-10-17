import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Classes du menu déroulant natif. Le menu natif est gardé exprès : sur
 * téléphone, il ouvre le sélecteur du système, plus confortable au toucher
 * qu'une liste faite maison. Hauteur 48 px sur mobile, 44 px dès `md`.
 */
export const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-12 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:text-sm";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(SELECT_CLASS, className)} {...props} />;
}

export { Select };
