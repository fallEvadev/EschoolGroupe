import { z } from "zod";

/** Les 7 rôles de la plateforme (stockés dans `publicMetadata.role` de Clerk). */
export const ROLES = [
  "formateur",
  "maintenancier",
  "directeur_partenaire",
  "admin_pedagogie",
  "admin_rh",
  "admin_maintenance",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

/** Libellés affichés à l'écran. */
export const ROLE_LABELS: Record<Role, string> = {
  formateur: "Formateur",
  maintenancier: "Maintenancier",
  directeur_partenaire: "Directeur partenaire",
  admin_pedagogie: "Admin Pédagogie",
  admin_rh: "Admin RH",
  admin_maintenance: "Admin Maintenance",
  super_admin: "Super-Admin",
};

const roleSchema = z.enum(ROLES);

/** Renvoie le rôle si la valeur est valide, sinon `null`. */
export function parseRole(value: unknown): Role | null {
  const result = roleSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Un espace = un groupe de routes, avec les rôles qui peuvent y entrer. */
export const SPACES = {
  formateur: {
    prefix: "/formateur",
    roles: ["formateur", "super_admin"],
  },
  maintenance: {
    prefix: "/maintenance",
    roles: ["maintenancier", "admin_maintenance", "super_admin"],
  },
  partenaire: {
    prefix: "/partenaire",
    roles: ["directeur_partenaire", "super_admin"],
  },
  admin: {
    prefix: "/admin",
    roles: ["admin_pedagogie", "admin_rh", "admin_maintenance", "super_admin"],
  },
} as const satisfies Record<string, { prefix: string; roles: readonly Role[] }>;

export type SpaceKey = keyof typeof SPACES;

/** Espace concerné par un chemin d'URL (ou `null` si le chemin n'est pas dans un espace). */
export function spaceForPath(pathname: string): SpaceKey | null {
  for (const key of Object.keys(SPACES) as SpaceKey[]) {
    const { prefix } = SPACES[key];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

export function canAccess(role: Role | null, space: SpaceKey): boolean {
  if (!role) return false;
  return (SPACES[space].roles as readonly Role[]).includes(role);
}

/** Pages réservées à certains rôles, plus strictes que l'espace qui les contient. */
const RESTRICTED_PATHS: { prefix: string; roles: readonly Role[] }[] = [
  { prefix: "/admin/acces", roles: ["super_admin"] },
  { prefix: "/admin/parametres", roles: ["super_admin"] },
];

/** Vrai si le rôle peut ouvrir ce chemin précis (en plus du contrôle de l'espace). */
export function canAccessPath(role: Role | null, pathname: string): boolean {
  const rule = RESTRICTED_PATHS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!rule) return true;
  return role !== null && rule.roles.includes(role);
}

/** Page d'accueil de chaque rôle après connexion. */
export function homeForRole(role: Role): string {
  switch (role) {
    case "formateur":
      return SPACES.formateur.prefix;
    case "maintenancier":
      return SPACES.maintenance.prefix;
    case "directeur_partenaire":
      return SPACES.partenaire.prefix;
    default:
      return SPACES.admin.prefix;
  }
}
