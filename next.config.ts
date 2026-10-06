import type { NextConfig } from "next";

/**
 * En-têtes de sécurité envoyés sur toutes les pages. L'application affiche des
 * pièces d'identité : elle ne doit pas pouvoir être intégrée dans le site d'un
 * tiers (clickjacking), ni voir ses fichiers réinterprétés par le navigateur.
 */
const securityHeaders = [
  // Interdit l'affichage de l'application dans une `<iframe>` d'un autre site.
  { key: "X-Frame-Options", value: "DENY" },
  // Équivalent moderne ; seule cette directive est posée (pas de CSP complète
  // pour l'instant : elle demande des tests avec Clerk et Supabase).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Le navigateur respecte le type de fichier annoncé.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // N'envoie aux autres sites que l'origine, jamais l'adresse complète
  // (elle contient l'identifiant d'une fiche).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Caméra et géolocalisation réservées à l'application (pointage, Lot 3) ;
  // micro et paiement coupés.
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=()",
  },
  // HTTPS obligatoire pendant un an (ignoré en développement sur http).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
