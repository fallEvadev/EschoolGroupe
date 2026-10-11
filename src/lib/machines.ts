/** Types d'équipement du parc (même liste que la contrainte SQL de `machines.kind`). */
export const MACHINE_KINDS = [
  "ordinateur",
  "videoprojecteur",
  "imprimante",
  "reseau",
  "autre",
] as const;

export type MachineKind = (typeof MACHINE_KINDS)[number];

export const MACHINE_KIND_LABELS: Record<MachineKind, string> = {
  ordinateur: "Ordinateur",
  videoprojecteur: "Vidéoprojecteur",
  imprimante: "Imprimante",
  reseau: "Réseau (routeur, switch…)",
  autre: "Autre",
};

export function isMachineKind(value: string): value is MachineKind {
  return (MACHINE_KINDS as readonly string[]).includes(value);
}

/** Libellé lisible d'un type, tolérant à une valeur inconnue de la base. */
export function machineKindLabel(value: string): string {
  return isMachineKind(value) ? MACHINE_KIND_LABELS[value] : value;
}

type SortableMachine = { label: string; status: string };

/**
 * Machines actives d'abord, archivées à la fin ; puis ordre naturel des noms,
 * pour que « PC 2 » passe avant « PC 10 ».
 */
export function sortMachines<T extends SortableMachine>(machines: T[]): T[] {
  return [...machines].sort(
    (a, b) =>
      Number(a.status === "archive") - Number(b.status === "archive") ||
      a.label.localeCompare(b.label, "fr", { numeric: true }),
  );
}
