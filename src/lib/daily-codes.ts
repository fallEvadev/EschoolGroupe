/** Nombre de chiffres d'un code quotidien. */
export const CODE_LENGTH = 6;

const CODE_MODULUS = 10 ** CODE_LENGTH;

/**
 * Code à 6 chiffres (zéros initiaux conservés : « 004281 »). Le tirage est
 * fourni par l'appelant : côté serveur, `crypto.randomInt` (imprévisible) ;
 * dans les tests, une valeur fixe.
 */
export function generateCode(randomBelow: (max: number) => number): string {
  return String(randomBelow(CODE_MODULUS)).padStart(CODE_LENGTH, "0");
}

/** Le texte est-il un code valide (exactement 6 chiffres) ? */
export function isCodeFormat(value: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
}

/** Affichage groupé par trois chiffres : « 428 105 », plus facile à dicter. */
export function formatCode(code: string): string {
  return isCodeFormat(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
