import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Page introuvable · E-School" };

/** Page affichée quand l'adresse n'existe pas ou que l'élément demandé est introuvable. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Page introuvable</CardTitle>
          <CardDescription>
            Cette page n&apos;existe pas ou n&apos;est plus disponible. Vérifiez
            l&apos;adresse, ou revenez à l&apos;accueil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
