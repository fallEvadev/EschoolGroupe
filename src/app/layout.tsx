import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/motion/app-providers";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="fr"
        className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          <AppProviders>{children}</AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
