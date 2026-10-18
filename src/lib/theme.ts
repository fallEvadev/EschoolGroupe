/** Choix de thème de la personne : suivre l'appareil, ou forcer clair / sombre. */
export type ThemeChoice = "auto" | "clair" | "sombre";

export const THEME_STORAGE_KEY = "eschool-theme";

export const THEME_LABELS: Record<ThemeChoice, string> = {
  auto: "Automatique",
  clair: "Clair",
  sombre: "Sombre",
};

/** Ordre du bouton : chaque appui passe au choix suivant. */
const ORDER: readonly ThemeChoice[] = ["auto", "clair", "sombre"];

export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === "clair" || value === "sombre" ? value : "auto";
}

export function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

/** Vrai si le thème sombre doit être affiché pour ce choix et ce réglage d'appareil. */
export function isDark(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): boolean {
  if (choice === "sombre") return true;
  if (choice === "clair") return false;
  return systemPrefersDark;
}
