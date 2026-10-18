"use client";

import {
  setThemeChoice,
  THEME_ICONS,
  useThemeChoice,
} from "@/components/theme/theme-toggle";
import { THEME_LABELS, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const CHOICES: readonly ThemeChoice[] = ["auto", "clair", "sombre"];

/** Trois boutons pour choisir l'affichage : automatique (appareil), clair ou sombre. */
export function ThemeChoiceButtons() {
  const current = useThemeChoice();

  return (
    <div
      role="radiogroup"
      aria-label="Affichage"
      className="grid grid-cols-3 gap-2"
    >
      {CHOICES.map((choice) => {
        const Icon = THEME_ICONS[choice];
        const active = choice === current;
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemeChoice(choice)}
            className={cn(
              "focus-visible:ring-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "border-primary bg-accent text-accent-foreground"
                : "hover:bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {THEME_LABELS[choice]}
          </button>
        );
      })}
    </div>
  );
}
