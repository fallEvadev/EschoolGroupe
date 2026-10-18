import { cn } from "@/lib/utils";

/**
 * Cube E-School : trois faces bleues et un « e » blanc sur la face de gauche.
 * Dessiné en SVG (net à toute taille, aucun fichier à charger). Les bleus sont
 * propres au logo et restent les mêmes en thème clair et sombre.
 *
 * Le même dessin sert d'icône d'onglet (`src/app/icon.svg`) : si on change ici,
 * y reporter le changement.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      focusable="false"
      className={cn("size-10 shrink-0", className)}
    >
      {/* Face du dessus : la plus claire */}
      <path d="M32 4 58 17 32 30 6 17Z" fill="#4db4ff" />
      {/* Face de gauche, portant le « e » */}
      <path d="M6 17 32 30V60L6 47Z" fill="#1f56e0" />
      {/* Face de droite : la plus sombre */}
      <path d="M58 17 32 30V60L58 47Z" fill="#1741b3" />
      {/* « e » blanc, incliné pour suivre la face de gauche */}
      <g transform="translate(19 38.5) skewY(26.57)">
        <path
          d="M-7 0H7A7 7 0 1 0 5 5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
