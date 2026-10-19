"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { findTourTarget } from "@/components/tour/find-target";
import { Button } from "@/components/ui/button";
import {
  computeBubblePosition,
  progressLabel,
  TOUR_MENU_EVENT,
  type Box,
  type TourStep,
} from "@/lib/tour";

/** Marge de l'anneau autour de l'élément montré. */
const SPOT_PADDING = 6;
const HAND_SIZE = 40;

/**
 * Le guide : l'écran s'assombrit, l'élément montré reste éclairé et entouré
 * d'un anneau qui pulse, une main animée le pointe, et une bulle explique
 * l'étape avec « Étape 2 sur 6 », Précédent, Suivant, Passer et Terminer.
 * Clavier : flèches pour avancer et reculer, Échap pour passer.
 */
export function GuidedTour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Box | null>(null);
  const [bubbleSize, setBubbleSize] = useState({ width: 320, height: 200 });
  const [viewport, setViewport] = useState({ width: 390, height: 800 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  const next = useCallback(() => {
    if (index >= steps.length - 1) onClose();
    else setIndex(index + 1);
  }, [index, steps.length, onClose]);
  const previous = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // L'espace admin ouvre ou referme son menu coulissant à la demande du guide.
  useEffect(() => {
    if (step?.closeMenu) {
      window.dispatchEvent(
        new CustomEvent(TOUR_MENU_EVENT, { detail: { open: false } }),
      );
    }
  }, [step]);

  // Suit l'élément montré : défilement doux jusqu'à lui, puis position à jour
  // quand l'écran change de taille ou défile.
  useLayoutEffect(() => {
    const element = findTourTarget(step?.target ?? null);
    if (!element) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
    const update = () => {
      const box = element.getBoundingClientRect();
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      });
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    // Une seconde mesure après le défilement doux.
    const settle = window.setTimeout(update, 400);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [step]);

  // Taille réelle de la bulle, pour la placer sans qu'elle déborde.
  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    const measure = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      setBubbleSize((old) =>
        old.width === width && old.height === height ? old : { width, height },
      );
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [index]);

  // Le focus suit l'étape (lecteurs d'écran et clavier).
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, onClose]);

  if (!step) return null;

  const spot: Box | null = rect && {
    top: rect.top - SPOT_PADDING,
    left: rect.left - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  };
  const placement = computeBubblePosition({
    target: spot,
    viewport,
    bubble: bubbleSize,
  });

  // La main est entre l'élément et la bulle, centrée sur l'élément.
  const handLeft = spot
    ? Math.max(
        8,
        Math.min(
          spot.left + spot.width / 2 - HAND_SIZE / 2,
          viewport.width - HAND_SIZE - 8,
        ),
      )
    : 0;
  const handTop = spot
    ? placement.side === "above"
      ? spot.top - HAND_SIZE - 2
      : spot.top + spot.height + 2
    : 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Bloque les clics sur la page pendant le guide */}
      <div className="absolute inset-0" aria-hidden />

      {spot ? (
        <div
          aria-hidden
          className="tour-spot pointer-events-none absolute rounded-xl"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.58)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/60" />
      )}

      {spot && placement.side !== "center" && (
        <span
          aria-hidden
          className={`pointer-events-none absolute text-4xl leading-none select-none ${
            placement.side === "above" ? "tour-hand-down" : "tour-hand-up"
          }`}
          style={{ top: handTop, left: handLeft, width: HAND_SIZE }}
        >
          {placement.side === "above" ? "👇" : "👆"}
        </span>
      )}

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-titre"
        aria-describedby="guide-texte"
        className="bg-card text-card-foreground absolute flex w-[min(20rem,calc(100vw-24px))] flex-col gap-3 rounded-2xl border p-4 shadow-2xl"
        style={{ top: placement.top, left: placement.left }}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            aria-live="polite"
            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
          >
            {progressLabel(index, steps.length)}
          </p>
          {!last && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-2 h-9 px-3 md:h-8"
              onClick={onClose}
            >
              Passer
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h2 id="guide-titre" className="text-lg leading-tight font-bold">
            {step.title}
          </h2>
          <p id="guide-texte" className="text-sm leading-relaxed">
            {step.text}
          </p>
        </div>

        {/* Barre de progression */}
        <div
          aria-hidden
          className="bg-muted h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={index === 0}
            onClick={previous}
          >
            Précédent
          </Button>
          <Button ref={nextRef} type="button" className="flex-1" onClick={next}>
            {last ? "Terminer" : "Suivant"}
          </Button>
        </div>
      </div>
    </div>
  );
}
