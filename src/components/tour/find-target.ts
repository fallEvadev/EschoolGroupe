/**
 * Élément visible portant `data-tour="…"`. Un même repère peut exister deux
 * fois (barre du bas sur téléphone, menu de l'en-tête sur ordinateur) : on
 * prend celui qu'on voit vraiment.
 */
export function findTourTarget(target: string | null): HTMLElement | null {
  if (!target) return null;
  // Guillemets et antislash protégés pour l'attribut de sélecteur.
  const safe = target.replace(/(["\\])/g, "\\$1");
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${safe}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}
