import { frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/motion/app-providers";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeScript } from "@/components/theme/theme-script";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Textes de Clerk (connexion, activation, menu du compte) en français. Les
 * titres sont écrits ici pour ne pas dépendre du nom de l'application saisi
 * dans le tableau de bord Clerk.
 */
const LOCALIZATION = {
  ...frFR,
  signIn: {
    ...frFR.signIn,
    start: {
      ...frFR.signIn?.start,
      title: "Connexion",
      subtitle: "Bienvenue sur E-School Groupe. Connectez-vous pour continuer.",
    },
  },
  signUp: {
    ...frFR.signUp,
    start: {
      ...frFR.signUp?.start,
      title: "Créer mon mot de passe",
      subtitle: "Dernière étape pour accéder à E-School Groupe.",
    },
  },
};

export const metadata: Metadata = {
  title: "E-School Groupe",
  description:
    "Suivi pédagogique, maintenance du parc informatique et gestion RH d'E-School Groupe.",
};

/** Plein écran sur téléphone : permet de tenir compte de la zone de sécurité (encoche, barre du bas). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Couleur de la barre d'état du téléphone, selon le thème.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1226" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider localization={LOCALIZATION}>
      <html
        lang="fr"
        className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <ThemeScript />
        </head>
        <body className="flex min-h-full flex-col">
          <AppProviders>{children}</AppProviders>
          <ServiceWorkerRegister />
        </body>
      </html>
    </ClerkProvider>
  );
}
