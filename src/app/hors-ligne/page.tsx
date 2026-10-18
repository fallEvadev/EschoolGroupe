import { WifiOff } from "lucide-react";

import { LogoMark } from "@/components/layout/logo-mark";

export const metadata = { title: "Hors ligne · E-School Groupe" };

/**
 * Page affichée quand le téléphone n'a plus de réseau (voir `public/sw.js`).
 * Publique et sans donnée : c'est la seule page gardée en mémoire. Le lien est
 * un simple `<a>` (pas de JavaScript) pour fonctionner même sans réseau.
 */
export default function HorsLignePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <LogoMark className="size-16" />
      <div className="flex flex-col items-center gap-2">
        <WifiOff className="text-muted-foreground size-8" aria-hidden />
        <h1 className="text-2xl font-extrabold">Vous êtes hors ligne</h1>
        <p className="text-muted-foreground max-w-sm text-base">
          Vérifiez votre connexion, puis réessayez. Ce que vous avez saisi dans
          un rapport reste gardé sur ce téléphone.
        </p>
      </div>
      {/* Lien HTML simple exprès : il doit marcher sans JavaScript, donc sans réseau. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="bg-primary text-primary-foreground inline-flex h-12 w-full max-w-xs items-center justify-center rounded-lg text-base font-semibold"
      >
        Réessayer
      </a>
    </main>
  );
}
