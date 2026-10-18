import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/motion/app-providers";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
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
        </body>
      </html>
    </ClerkProvider>
  );
}
