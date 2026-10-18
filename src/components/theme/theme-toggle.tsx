"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import {
  isDark,
  nextThemeChoice,
  parseThemeChoice,
  THEME_LABELS,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export const THEME_ICONS = { auto: Monitor, clair: Sun, sombre: Moon } as const;

// Le choix vit dans le navigateur (localStorage) : on le lit comme une source
// externe, ce qui évite tout décalage entre le serveur et le premier affichage.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener); // autre onglet
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readChoice(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "auto"; // stockage indisponible
  }
}

function apply(choice: ThemeChoice) {
  const dark = isDark(
    choice,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Choix de thème actuel de la personne (Automatique tant qu'elle n'a rien choisi). */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => "auto");
}

/** Enregistre et applique le choix ; tous les boutons de thème se mettent à jour. */
export function setThemeChoice(next: ThemeChoice) {
  try {
    if (next === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Le choix ne sera pas gardé, mais on l'applique pour cette visite.
  }
  apply(next);
  listeners.forEach((listener) => listener());
}

/**
 * Bouton « Thème » : un appui passe d'Automatique (réglage de l'appareil) à
 * Clair, puis Sombre. Le choix est gardé dans le navigateur de la personne.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useThemeChoice();

  // Applique le choix (le script de l'en-tête l'a déjà fait au chargement) et,
  // en automatique, suit l'appareil s'il change de thème.
  useEffect(() => {
    apply(choice);
    if (choice !== "auto") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("auto");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  const Icon = THEME_ICONS[choice];
  const label = `Thème : ${THEME_LABELS[choice].toLowerCase()}. Appuyez pour changer.`;

  return (
    <button
      type="button"
      onClick={() => setThemeChoice(nextThemeChoice(choice))}
      aria-label={label}
      title={label}
      className={cn(
        "text-foreground hover:bg-muted focus-visible:ring-ring flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
