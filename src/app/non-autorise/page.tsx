import { SignOutButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NonAutorisePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accès non autorisé</CardTitle>
          <CardDescription>
            Votre compte n&apos;a pas les droits pour cette page, ou son rôle
            n&apos;est pas encore attribué. Contactez l&apos;administration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton redirectUrl="/connexion">
            <Button variant="outline">Se déconnecter</Button>
          </SignOutButton>
        </CardContent>
      </Card>
    </main>
  );
}
