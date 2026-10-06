"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { AccessResult } from "@/lib/validations/access";

import { setUserActive, updateUserRole } from "./actions";

export type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  banned: boolean;
  isSelf: boolean;
};

/** Une ligne de la liste : choix du rôle et activation du compte. */
export function UserAccessRow({ user }: { user: AccessUser }) {
  const [selected, setSelected] = useState<Role | "">(user.role ?? "");
  const [pending, startTransition] = useTransition();

  const changed = selected !== "" && selected !== user.role;

  /** Résultat d'une action, affiché en notification. */
  function notify(result: AccessResult) {
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  function saveRole() {
    if (!selected) return;
    startTransition(async () => {
      notify(await updateUserRole({ userId: user.id, role: selected }));
    });
  }

  function toggleActive() {
    startTransition(async () => {
      notify(await setUserActive({ userId: user.id, active: user.banned }));
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {user.name}
            {user.isSelf && (
              <span className="text-muted-foreground font-normal"> (vous)</span>
            )}
          </p>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.role ? (
            <Badge>{ROLE_LABELS[user.role]}</Badge>
          ) : (
            <Badge variant="warning">Sans rôle</Badge>
          )}
          <Badge variant={user.banned ? "destructive" : "success"}>
            {user.banned ? "Désactivé" : "Actif"}
          </Badge>
        </div>
      </div>

      {user.isSelf ? (
        <p className="text-muted-foreground text-sm">
          Votre propre compte ne peut pas être modifié ici.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor={`role-${user.id}`}>
            Rôle de {user.name}
          </label>
          <select
            id={`role-${user.id}`}
            value={selected}
            disabled={pending}
            onChange={(event) => {
              setSelected(event.target.value as Role | "");
            }}
            className="border-input bg-card focus-visible:ring-ring h-11 rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none sm:w-60 md:text-sm"
          >
            <option value="" disabled>
              Choisir un rôle…
            </option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <Button onClick={saveRole} disabled={!changed || pending}>
            Enregistrer le rôle
          </Button>
          {user.banned ? (
            <Button variant="outline" onClick={toggleActive} disabled={pending}>
              Réactiver
            </Button>
          ) : (
            // Action risquée : confirmation avant de couper l'accès.
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={pending}>
                  Désactiver
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Désactiver ce compte ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.name} ne pourra plus se connecter. Son historique est
                    conservé et le compte peut être réactivé à tout moment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={toggleActive}
                  >
                    Désactiver le compte
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </li>
  );
}
