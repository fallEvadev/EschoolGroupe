import {
  CalendarDays,
  ChartColumn,
  FileText,
  FolderOpen,
  House,
  KeyRound,
  LayoutDashboard,
  Monitor,
  NotebookPen,
  School,
  Settings,
  ShieldCheck,
  Ticket,
  User,
  UserCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Lot qui livre la page. Tant que `available` est faux, l'entrée est grisée. */
  lot: number;
  available: boolean;
  /** Rôles qui voient l'entrée (tous si absent). */
  roles?: readonly Role[];
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

const ADMIN_PEDAGOGIE = ["admin_pedagogie", "super_admin"] as const;

/** Menu latéral de l'espace admin (maquette « Direction pédagogique »). */
export const ADMIN_NAV: NavSection[] = [
  {
    title: "Pilotage pédagogique",
    items: [
      {
        label: "Tableau de bord",
        href: "/admin",
        icon: LayoutDashboard,
        lot: 1,
        available: true,
      },
      {
        label: "Pointages",
        href: "/admin/pointages",
        icon: UserCheck,
        lot: 3,
        available: false,
        roles: ADMIN_PEDAGOGIE,
      },
      {
        label: "Cahiers & rapports",
        href: "/admin/rapports",
        icon: FileText,
        lot: 4,
        available: false,
        roles: ADMIN_PEDAGOGIE,
      },
      {
        label: "Codes de séance",
        href: "/admin/codes",
        icon: KeyRound,
        lot: 3,
        available: false,
        roles: ADMIN_PEDAGOGIE,
      },
      {
        label: "Bilans",
        href: "/admin/bilans",
        icon: ChartColumn,
        lot: 6,
        available: false,
        roles: ADMIN_PEDAGOGIE,
      },
    ],
  },
  {
    title: "Organisation",
    items: [
      {
        label: "Personnel",
        href: "/admin/personnel",
        icon: Users,
        lot: 2,
        available: true,
        roles: ["admin_rh", "super_admin"],
      },
      {
        label: "Maintenance",
        href: "/admin/maintenance",
        icon: Wrench,
        lot: 5,
        available: false,
        roles: ["admin_maintenance", "super_admin"],
      },
      {
        label: "Écoles",
        href: "/admin/ecoles",
        icon: School,
        lot: 3,
        available: false,
        roles: ADMIN_PEDAGOGIE,
      },
      {
        label: "Documents",
        href: "/admin/documents",
        icon: FolderOpen,
        lot: 2,
        available: false,
        roles: ["admin_pedagogie", "admin_rh", "super_admin"],
      },
      {
        label: "Accès & rôles",
        href: "/admin/acces",
        icon: ShieldCheck,
        lot: 1,
        available: true,
        roles: ["super_admin"],
      },
      {
        label: "Paramètres",
        href: "/admin/parametres",
        icon: Settings,
        lot: 1,
        available: true,
        roles: ["super_admin"],
      },
    ],
  },
];

/** Barre du bas du formateur (maquette « Accueil formateur »). */
export const FORMATEUR_NAV: NavItem[] = [
  {
    label: "Accueil",
    href: "/formateur",
    icon: House,
    lot: 1,
    available: true,
  },
  {
    label: "Planning",
    href: "/formateur/planning",
    icon: CalendarDays,
    lot: 3,
    available: false,
  },
  {
    label: "Cahiers",
    href: "/formateur/cahiers",
    icon: NotebookPen,
    lot: 4,
    available: false,
  },
  {
    label: "Documents",
    href: "/formateur/documents",
    icon: FolderOpen,
    lot: 2,
    available: false,
  },
  {
    label: "Profil",
    href: "/formateur/profil",
    icon: User,
    lot: 2,
    available: false,
  },
];

/** Barre du bas du maintenancier (maquette « Mes tickets »). */
export const MAINTENANCE_NAV: NavItem[] = [
  {
    label: "Tickets",
    href: "/maintenance",
    icon: Ticket,
    lot: 5,
    available: true,
  },
  {
    label: "Interventions",
    href: "/maintenance/interventions",
    icon: Wrench,
    lot: 5,
    available: false,
  },
  {
    label: "Équipements",
    href: "/maintenance/equipements",
    icon: Monitor,
    lot: 5,
    available: false,
  },
  {
    label: "Profil",
    href: "/maintenance/profil",
    icon: User,
    lot: 2,
    available: false,
  },
];

/** Sections visibles pour un rôle (les sections vides disparaissent). */
export function sectionsForRole(
  sections: NavSection[],
  role: Role,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || (item.roles as readonly Role[]).includes(role),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
