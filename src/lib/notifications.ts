import type { Role } from "@/lib/auth/roles";

/**
 * Rôles qui reçoivent des notifications : le formateur (décisions sur ses
 * rapports) et la Direction pédagogique (nouveaux rapports à traiter).
 */
export const NOTIFIED_ROLES: readonly Role[] = [
  "formateur",
  "admin_pedagogie",
  "super_admin",
];

/** Page des notifications de chaque espace. */
export const NOTIFICATIONS_PATH = {
  formateur: "/formateur/notifications",
  admin: "/admin/notifications",
} as const;

/** Intervalle de rafraîchissement du badge (une minute). */
export const NOTIFICATION_POLL_MS = 60_000;

/** Texte du badge : le nombre, plafonné à « 9+ » ; rien s'il n'y en a pas. */
export function badgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? "9+" : String(Math.floor(count));
}

/** Faut-il signaler qu'une nouvelle notification est arrivée ? */
export function hasNewNotification(previous: number, next: number): boolean {
  return next > previous;
}

/** Libellé accessible de la cloche. */
export function bellLabel(count: number): string {
  if (count <= 0) return "Notifications";
  return count === 1
    ? "Notifications : 1 non lue"
    : `Notifications : ${count} non lues`;
}

/** Une notification affichée dans la liste. */
export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

/**
 * Un lien de notification doit rester dans l'application : un chemin qui
 * commence par une seule barre. La base le contrôle déjà ; on revérifie avant
 * d'afficher un lien.
 */
export function safeInternalLink(link: string | null): string | null {
  if (!link) return null;
  return /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(link) ? link : null;
}
