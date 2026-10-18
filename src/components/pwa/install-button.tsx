"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
 * Bouton « Installer l'application » des en-têtes. Il n'apparaît que si
 * l'installation est possible : jamais dans l'application déjà installée.
 * Sur iPhone, Safari n'a pas de bouton d'installation automatique : on affiche
 * la marche à suivre.
 */
export function InstallButton({ className }: { className?: string }) {
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

  if (!event && !showIosHelp) return null;

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
