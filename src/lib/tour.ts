/**
 * Guide interactif : étapes de chaque espace, et calculs purs (position de la
 * bulle, progression, clés de mémorisation). L'affichage est dans
 * `src/components/tour/`. Rien ici ne dépend du navigateur, pour être testé.
 *
 * Chaque étape pointe un élément RÉEL de l'interface, repéré par l'attribut
 * `data-tour="…"` posé dans les menus (voir `navTourId`). Une étape `optional`
 * est retirée du guide si son élément n'existe pas pour cette personne (un
 * menu masqué selon son rôle, par exemple).
 */

export type TourSpace = "formateur" | "maintenance" | "admin" | "partenaire";

export type TourStep = {
  id: string;
  /** Valeur de `data-tour` de l'élément à montrer ; `null` : bulle au centre. */
  target: string | null;
  title: string;
  text: string;
  /** Retirer l'étape si l'élément est absent (sinon bulle au centre). */
  optional?: boolean;
  /** Ouvrir le menu coulissant avant l'étape (téléphone, espace admin). */
  openMenu?: boolean;
  /** Refermer le menu coulissant avant l'étape. */
  closeMenu?: boolean;
};

/** Valeur de `data-tour` d'une entrée de menu : `nav:/formateur/planning`. */
export function navTourId(href: string): string {
  return `nav:${href}`;
}

const nav = (
  href: string,
  title: string,
  text: string,
  extra: Partial<TourStep> = {},
): TourStep => ({
  id: `nav-${href}`,
  target: navTourId(href),
  title,
  text,
  ...extra,
});

const BELL: TourStep = {
  id: "cloche",
  target: "cloche",
  title: "Notifications",
  text: "Un nombre rouge apparaît ici quand quelque chose demande votre attention.",
  optional: true,
};

const HELP: TourStep = {
  id: "aide",
  target: "aide",
  title: "Besoin d'aide ?",
  text: "Ce bouton relance ce guide quand vous voulez.",
};

export const TOUR_STEPS: Record<TourSpace, readonly TourStep[]> = {
  formateur: [
    {
      id: "menu",
      target: "menu",
      title: "Votre menu",
      text: "Ces boutons vous mènent partout : accueil, planning, cahiers, documents et profil.",
    },
    nav(
      "/formateur/planning",
      "Planning",
      "Vos créneaux de la semaine : jours, horaires et écoles.",
    ),
    nav(
      "/formateur/cahiers",
      "Cahiers",
      "C'est ici que se rédigent vos rapports. Un rapport s'ouvre 10 minutes avant la fin du cours.",
    ),
    nav(
      "/formateur/documents",
      "Documents",
      "Le programme du mois et le règlement intérieur.",
    ),
    nav(
      "/formateur/profil",
      "Profil",
      "Vos informations, votre téléphone, le thème clair ou sombre et l'installation de l'application.",
    ),
    BELL,
    HELP,
  ],
  maintenance: [
    {
      id: "menu",
      target: "menu",
      title: "Votre menu",
      text: "Ces boutons vous mènent à vos tickets, vos interventions, les équipements et votre profil.",
    },
    nav(
      "/maintenance",
      "Tickets",
      "Les pannes qui vous sont confiées, les plus anciennes en premier.",
    ),
    nav(
      "/maintenance/interventions",
      "Interventions",
      "L'historique des tickets que vous avez résolus.",
    ),
    nav(
      "/maintenance/equipements",
      "Équipements",
      "Les machines de chaque école.",
    ),
    nav(
      "/maintenance/profil",
      "Profil",
      "Vos informations, votre téléphone et le thème clair ou sombre.",
    ),
    BELL,
    HELP,
  ],
  partenaire: [
    nav(
      "/partenaire",
      "Code de descente",
      "Le code s'affiche à la fin du premier cours. Donnez-le aux formateurs une fois leur cours terminé, pas avant.",
    ),
    nav(
      "/partenaire/bilans",
      "Bilans",
      "Les bilans publiés pour votre école, à télécharger en PDF.",
    ),
    BELL,
    HELP,
  ],
  admin: [
    {
      id: "intro",
      target: null,
      title: "Bienvenue dans l'administration",
      text: "Ce guide vous montre les pages principales. Elles dépendent de votre rôle : vous ne voyez que les vôtres.",
      openMenu: true,
    },
    {
      id: "menu",
      target: "menu",
      title: "Le menu",
      text: "Toutes les pages de l'administration sont ici, rangées par thème.",
    },
    nav(
      "/admin",
      "Tableau de bord",
      "Les chiffres du jour et des graphiques, adaptés à votre rôle.",
      { optional: true },
    ),
    nav(
      "/admin/pointages",
      "Pointages",
      "Qui est arrivé, qui est reparti, les retards et les absences. C'est aussi ici que vous validez une descente.",
      { optional: true },
    ),
    nav(
      "/admin/rapports",
      "Cahiers et rapports",
      "Les rapports envoyés par les formateurs : valider, corriger ou demander une modification.",
      { optional: true },
    ),
    nav(
      "/admin/codes",
      "Codes du jour",
      "Générez le code de chaque école le matin. Le directeur le donne aux formateurs après le cours.",
      { optional: true },
    ),
    nav(
      "/admin/bilans",
      "Bilans",
      "Générez les bilans par semaine ou par mois, déposez le PDF final et publiez-le.",
      { optional: true },
    ),
    nav(
      "/admin/ecoles",
      "Écoles",
      "Les écoles, leurs créneaux et l'affectation des formateurs.",
      { optional: true },
    ),
    nav(
      "/admin/personnel",
      "Personnel",
      "Les fiches du personnel, leurs documents et leur état.",
      { optional: true },
    ),
    nav(
      "/admin/parc",
      "Parc informatique",
      "L'inventaire des machines de chaque école.",
      { optional: true },
    ),
    nav(
      "/admin/maintenance",
      "Tickets de pannes",
      "Les pannes signalées : affecter un maintenancier et suivre la résolution.",
      { optional: true },
    ),
    nav(
      "/admin/acces",
      "Accès et rôles",
      "Donner un accès à une personne et lui attribuer un rôle.",
      { optional: true },
    ),
    { ...BELL, closeMenu: true },
    HELP,
  ],
};

export function tourSteps(space: TourSpace): readonly TourStep[] {
  return TOUR_STEPS[space];
}

/** « Étape 2 sur 6 » (l'index part de 0). */
export function progressLabel(index: number, total: number): string {
  return `Étape ${index + 1} sur ${total}`;
}

/** Clé du navigateur qui retient qu'un espace a déjà montré son guide. */
export function tourStorageKey(space: TourSpace): string {
  return `eschool-guide-${space}`;
}

/** Page d'accueil de chaque espace : le guide s'y lance seul, à la première visite. */
export const TOUR_HOME: Record<TourSpace, string> = {
  formateur: "/formateur",
  maintenance: "/maintenance",
  admin: "/admin",
  partenaire: "/partenaire",
};

/** Nom de l'événement qui demande à l'espace admin d'ouvrir ou fermer son menu coulissant. */
export const TOUR_MENU_EVENT = "eschool:guide-menu";

export type Box = { top: number; left: number; width: number; height: number };

export type BubblePlacement = {
  top: number;
  left: number;
  /** Où est la bulle par rapport à l'élément montré. */
  side: "below" | "above" | "center";
};

/**
 * Place la bulle près de l'élément : dessous s'il reste de la place, sinon
 * dessus, sinon à la meilleure position possible ; centrée sur l'élément mais
 * toujours entièrement dans l'écran. Sans élément : au centre de l'écran.
 * `gap` laisse la place de la main qui pointe.
 */
export function computeBubblePosition({
  target,
  viewport,
  bubble,
  gap = 56,
  margin = 12,
}: {
  target: Box | null;
  viewport: { width: number; height: number };
  bubble: { width: number; height: number };
  gap?: number;
  margin?: number;
}): BubblePlacement {
  const clampLeft = (value: number) =>
    Math.max(margin, Math.min(value, viewport.width - bubble.width - margin));

  if (!target) {
    return {
      side: "center",
      top: Math.max(margin, (viewport.height - bubble.height) / 2),
      left: clampLeft((viewport.width - bubble.width) / 2),
    };
  }

  const targetBottom = target.top + target.height;
  const spaceBelow = viewport.height - targetBottom - gap - margin;
  const spaceAbove = target.top - gap - margin;
  const left = clampLeft(target.left + target.width / 2 - bubble.width / 2);

  if (spaceBelow >= bubble.height) {
    return { side: "below", top: targetBottom + gap, left };
  }
  if (spaceAbove >= bubble.height) {
    return { side: "above", top: target.top - gap - bubble.height, left };
  }
  // Ni dessus ni dessous ne suffit : on garde la bulle dans l'écran, du côté le plus large.
  const side = spaceBelow >= spaceAbove ? "below" : "above";
  return {
    side,
    top: Math.max(margin, viewport.height - bubble.height - margin),
    left,
  };
}
