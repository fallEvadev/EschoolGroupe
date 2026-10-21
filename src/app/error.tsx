"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Page affichée quand une page plante pendant son chargement : au lieu d'un
 * écran blanc ou d'un message technique en anglais, l'utilisateur peut
 * réessayer ou revenir à l'accueil. Le détail technique reste dans la console
 * du serveur ; seul un code court (`digest`) est montré, pour le retrouver.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Une erreur est survenue</CardTitle>
          <CardDescription>
            La page n&apos;a pas pu s&apos;afficher. Vérifiez votre connexion
            puis réessayez. Si le problème continue, prévenez l&apos;administration.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => retry()}>Réessayer</Button>
            <Button variant="outline" asChild>
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </div>
          {error.digest && (
            <p className="text-muted-foreground text-xs">
              Code de l&apos;erreur : {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
