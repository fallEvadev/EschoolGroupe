/**
 * Matériel que le formateur signale en panne. Les formateurs parlent de
 * « la souris » ou « l'écran », pas de « machine n°3 » : on propose donc des
 * types, et « Autre » pour tout le reste (le nom se saisit alors à la main).
 */
export const EQUIPMENT_TYPES = [
  "Souris",
  "Clavier",
  "Écran",
  "Unité centrale",
  "Vidéoprojecteur",
  "Imprimante",
  "Internet / réseau",
  "Électricité",
] as const;

/** Le type proposé qui correspond au nom enregistré, ou `null` (nom libre). */
export function equipmentTypeOf(equipment: string): string | null {
  return EQUIPMENT_TYPES.find((type) => type === equipment) ?? null;
}
