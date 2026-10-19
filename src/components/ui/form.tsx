import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Éléments communs à tous les formulaires : un champ (libellé, contrôle, aide,
 * erreur), les messages du formulaire et la rangée de boutons. Ils remplacent
 * les copies écrites page par page, pour que partout les champs, messages et
 * boutons aient le même aspect et le même comportement.
 */

/**
 * Attributs d'accessibilité d'un contrôle : marqué invalide et relié à son aide
 * et à son message d'erreur (que `Field` affiche avec les identifiants
 * `${id}-hint` et `${id}-error`). `Field` les pose tout seul sur son contrôle ;
 * cette fonction sert aux cas où le contrôle n'est pas l'enfant direct.
 */
export function fieldProps(
  id: string,
  { error, hint }: { error?: string; hint?: string } = {},
) {
  const describedBy = [
    hint && !error ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };
}

/**
 * Un champ : libellé, contrôle, aide (masquée quand il y a une erreur) et
 * erreur. Si le contrôle est l'unique enfant, `Field` lui donne son `id` et ses
 * attributs `aria-*` ; ce que le contrôle précise lui-même est conservé.
 */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  /** Identifiant du contrôle. */
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const control = React.isValidElement<Record<string, unknown>>(children)
    ? React.cloneElement(children, {
        ...fieldProps(id, { error, hint }),
        ...children.props,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Erreur de l'ensemble du formulaire (réponse du serveur, par exemple). */
export function FormError({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("text-destructive text-sm font-medium", className)}
    >
      {children}
    </p>
  );
}

/**
 * Résultat d'une action, lu par les lecteurs d'écran sans interrompre : vert si
 * réussi, rouge sinon. À placer au-dessus des boutons pour rester visible sur
 * téléphone.
 */
export function FormStatus({
  ok,
  children,
  className,
}: {
  ok?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-sm font-medium",
        ok ? "text-success" : "text-destructive",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Rangée de boutons d'un formulaire : empilés en pleine largeur sur téléphone,
 * côte à côte dès `sm`. Le bouton principal vient en premier.
 */
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
