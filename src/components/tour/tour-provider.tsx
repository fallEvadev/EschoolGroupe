"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { findTourTarget } from "@/components/tour/find-target";
import { GuidedTour } from "@/components/tour/guided-tour";
import {
  TOUR_HOME,
  TOUR_MENU_EVENT,
  tourStorageKey,
  tourSteps,
  type TourSpace,
  type TourStep,
} from "@/lib/tour";

type TourContextValue = { start: () => void };

const TourContext = createContext<TourContextValue | null>(null);

/** Relance le guide (bouton « Aide »). Sans effet hors d'un espace qui a un guide. */
export function useTour(): TourContextValue {
  return useContext(TourContext) ?? { start: () => undefined };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function markSeen(space: TourSpace) {
  try {
    localStorage.setItem(tourStorageKey(space), "1");
  } catch {
    // Stockage indisponible : le guide pourra se relancer, sans conséquence.
  }
}

function alreadySeen(space: TourSpace): boolean {
  try {
    return localStorage.getItem(tourStorageKey(space)) !== null;
  } catch {
    // Sans stockage on ne le lance pas tout seul (il se relancerait à chaque page).
    return true;
  }
}

/**
 * Fournit le guide d'un espace. Il se lance tout seul à la première visite de
 * la page d'accueil, puis à la demande avec le bouton « Aide ». Les étapes dont
 * l'élément n'existe pas pour cette personne sont retirées (un menu masqué
 * selon son rôle), pour que « Étape 2 sur N » reste juste.
 */
export function TourProvider({
  space,
  children,
}: {
  space: TourSpace;
  children: React.ReactNode;
}) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const pathname = usePathname();

  const start = useCallback(async () => {
    const all = tourSteps(space);
    // Téléphone, espace admin : le menu est caché, on l'ouvre pour le montrer.
    if (all[0]?.openMenu) {
      window.dispatchEvent(
        new CustomEvent(TOUR_MENU_EVENT, { detail: { open: true } }),
      );
      await wait(450);
    }
    const effective = all.filter(
      (step) => !step.optional || findTourTarget(step.target) !== null,
    );
    if (effective.length > 0) setSteps(effective);
  }, [space]);

  const close = useCallback(() => {
    markSeen(space);
    window.dispatchEvent(
      new CustomEvent(TOUR_MENU_EVENT, { detail: { open: false } }),
    );
    setSteps(null);
  }, [space]);

  // Première visite de l'accueil : le guide se lance tout seul, sans brusquer.
  useEffect(() => {
    if (pathname !== TOUR_HOME[space] || alreadySeen(space)) return;
    const timer = window.setTimeout(() => void start(), 1200);
    return () => window.clearTimeout(timer);
  }, [pathname, space, start]);

  const value = useMemo(() => ({ start: () => void start() }), [start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {steps && <GuidedTour steps={steps} onClose={close} />}
    </TourContext.Provider>
  );
}
