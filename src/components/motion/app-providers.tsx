"use client";

import { MotionConfig } from "framer-motion";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Réglages communs de l'interface : animations coupées si l'utilisateur a
 * demandé à les réduire (réglage du système), bulles d'aide et notifications.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </MotionConfig>
  );
}
