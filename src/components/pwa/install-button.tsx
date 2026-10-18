"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Événement du navigateur qui permet de proposer l'installation (Chrome, Edge, Android). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Installation de l'application. `canInstall` est faux dans l'application déjà
 * installée. Sur iPhone, Safari n'a pas de bouton d'installation automatique :
 * on affiche la marche à suivre.
 */
function useInstall(): { canInstall: boolean; install: () => Promise<void> } {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    // L'état dépend du navigateur, connu seulement après l'affichage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos()) setShowIosHelp(true);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // on propose l'installation avec notre bouton
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (event) {
      await event.prompt();
      await event.userChoice;
      setEvent(null);
    } else {
      toast.info(
        "Pour installer : touchez le bouton Partager, puis « Sur l'écran d'accueil ».",
      );
    }
  }

  return { canInstall: !!event || showIosHelp, install };
}

/**
 * Bouton « Installer l'application » des en-têtes. Il n'apparaît que si
 * l'installation est possible : jamais dans l'application déjà installée.
 */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, install } = useInstall();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Installer l'application"
      title="Installer l'application"
      className={cn(
        "text-foreground hover:bg-muted focus-visible:ring-ring flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <Download className="size-5" aria-hidden />
    </button>
  );
}

/** Bloc « Application » de la page Profil : absent si l'installation n'est pas possible. */
export function InstallCard() {
  const { canInstall, install } = useInstall();
  if (!canInstall) return null;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-6">
      <h2 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Application
      </h2>
      <p className="text-muted-foreground text-sm">
        Installez E-School sur votre écran d&apos;accueil pour l&apos;ouvrir
        comme une application.
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto sm:self-start"
        onClick={() => void install()}
      >
        <Download aria-hidden />
        Installer l&apos;application
      </Button>
    </Card>
  );
}
