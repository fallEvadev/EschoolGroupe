import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application installable (PWA). Les couleurs reprennent la
 * charte : fond clair et bleu de marque. En mode « standalone », l'application
 * s'ouvre en plein écran, sans la barre d'adresse du navigateur.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "E-School Groupe",
    short_name: "E-School",
    description:
      "Suivi pédagogique, maintenance du parc informatique et gestion RH d'E-School Groupe.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5fa",
    theme_color: "#2952d9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
