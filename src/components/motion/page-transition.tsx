"use client";

import { motion } from "framer-motion";

/** Entrée de page : léger fondu vers le haut (rejoué à chaque navigation). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-w-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
