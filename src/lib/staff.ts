/** Types de contrat (mêmes valeurs que la contrainte SQL `contract_type`). */
export const CONTRACT_TYPES = [
  "cdi",
  "cdd",
  "vacataire",
  "stage",
  "prestataire",
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_LABELS: Record<ContractType, string> = {
  cdi: "CDI",
  cdd: "CDD",
  vacataire: "Vacataire",
  stage: "Stage",
  prestataire: "Prestataire",
};

/** Statuts d'une fiche (mêmes valeurs que la contrainte SQL `status`). */
export const STAFF_STATUSES = [
  "invite",
  "actif",
  "inactif",
  "archive",
] as const;

export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STATUS_LABELS: Record<StaffStatus, string> = {
  invite: "Invitation envoyée",
  actif: "Actif",
  inactif: "Inactif",
  archive: "Archivé",
};

export const STATUS_BADGE: Record<
  StaffStatus,
  "success" | "warning" | "destructive" | "neutral"
> = {
  invite: "warning",
  actif: "success",
  inactif: "destructive",
  archive: "neutral",
};

/** Actions de l'Admin RH sur le statut d'une fiche. */
export const STATUS_ACTIONS = ["deactivate", "reactivate", "archive"] as const;

export type StatusAction = (typeof STATUS_ACTIONS)[number];

export const STATUS_ACTION_LABELS: Record<StatusAction, string> = {
  deactivate: "Désactiver",
  reactivate: "Réactiver",
  archive: "Archiver",
};

/** Désactiver et archiver coupent l'accès : un motif est exigé. */
export function needsReason(action: StatusAction): boolean {
  return action !== "reactivate";
}

/**
 * Statut obtenu après une action, ou `null` si elle n'est pas permise.
 * `hasAccount` : la personne a-t-elle déjà activé son compte ? Sans compte,
 * réactiver ramène la fiche à « invite » (il faudra renvoyer l'invitation).
 */
export function nextStatus(
  current: StaffStatus,
  action: StatusAction,
  hasAccount: boolean,
): StaffStatus | null {
  switch (action) {
    case "deactivate":
      return current === "actif" ? "inactif" : null;
    case "reactivate":
      if (current !== "inactif" && current !== "archive") return null;
      return hasAccount ? "actif" : "invite";
    case "archive":
      return current === "archive" ? null : "archive";
  }
}

/** Actions proposées pour une fiche selon son statut. */
export function availableStatusActions(
  current: StaffStatus,
  hasAccount: boolean,
): StatusAction[] {
  return STATUS_ACTIONS.filter(
    (action) => nextStatus(current, action, hasAccount) !== null,
  );
}

export function isStaffStatus(value: string): value is StaffStatus {
  return (STAFF_STATUSES as readonly string[]).includes(value);
}

export function isContractType(value: string): value is ContractType {
  return (CONTRACT_TYPES as readonly string[]).includes(value);
}

/** Initiales affichées dans la pastille (ex. « Babacar Ndiaye » → « BN »). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Numéro lisible : « 771234567 » → « 77 123 45 67 » (indicatif conservé). */
export function formatPhone(phone: string): string {
  const match = /^(\+221|00221)?(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  if (!match) return phone;
  const [, prefix, a, b, c, d] = match;
  return [prefix, a, b, c, d].filter(Boolean).join(" ");
}

/** Sépare un nom complet : le dernier mot est le nom de famille. */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}
