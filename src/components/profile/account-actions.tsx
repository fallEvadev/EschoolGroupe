"use client";

import { SignOutButton, useClerk } from "@clerk/nextjs";
import { LogOut, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Gérer son compte (mot de passe, e-mail : fenêtre de Clerk) et se déconnecter.
 * Le mot de passe n'est jamais vu ni stocké par l'application.
 */
export function AccountActions() {
  const { openUserProfile } = useClerk();

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => openUserProfile()}
      >
        <UserCog aria-hidden />
        Gérer mon compte
      </Button>
      <SignOutButton redirectUrl="/connexion">
        <Button type="button" variant="outline" className="w-full sm:w-auto">
          <LogOut aria-hidden />
          Se déconnecter
        </Button>
      </SignOutButton>
    </div>
  );
}
