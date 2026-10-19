"use client";

import { CircleHelp } from "lucide-react";

import { useTour } from "@/components/tour/tour-provider";
import { cn } from "@/lib/utils";

/** Bouton « Aide » des en-têtes : relance le guide à tout moment. */
export function HelpButton({ className }: { className?: string }) {
  const { start } = useTour();
  return (
    <button
      type="button"
      data-tour="aide"
      onClick={start}
      aria-label="Aide : revoir le guide"
      title="Aide : revoir le guide"
      className={cn(
        "text-foreground hover:bg-muted focus-visible:ring-ring flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <CircleHelp className="size-5" aria-hidden />
    </button>
  );
}
