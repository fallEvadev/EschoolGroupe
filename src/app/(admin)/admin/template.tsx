import { PageTransition } from "@/components/motion/page-transition";

/** Rejoué à chaque changement de page de l'espace admin (animation d'entrée). */
export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
