import type { Role } from "@/lib/auth/roles";

/**
 * Rôles qui doivent accepter le règlement intérieur avant d'utiliser la
 * plateforme : le personnel de terrain. Les administrateurs et les
 * directeurs partenaires ne sont pas bloqués.
 */
export const RULES_REQUIRED_ROLES = [
  "formateur",
  "maintenancier",
] as const satisfies readonly Role[];

/** Ce rôle doit-il accepter le règlement ? */
export function mustAcceptRules(role: Role | null): boolean {
  return (
    role !== null && (RULES_REQUIRED_ROLES as readonly Role[]).includes(role)
  );
}

type StaffToCheck = { id: string; role: Role; status: string };

/**
 * Personnes qui n'ont pas encore accepté la version en vigueur : comptes
 * actifs dont le rôle est concerné, sans acceptation enregistrée.
 */
export function staffMissingAcceptance<T extends StaffToCheck>(
  staff: readonly T[],
  acceptedProfileIds: ReadonlySet<string>,
): T[] {
  return staff.filter(
    (person) =>
      person.status === "actif" &&
      mustAcceptRules(person.role) &&
      !acceptedProfileIds.has(person.id),
  );
}
