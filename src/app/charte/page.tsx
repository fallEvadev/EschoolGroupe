import { Check, Clock, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* Page temporaire : aperçu de la charte graphique (lot 1, étape 2). */
const couleurs = [
  { nom: "Primaire", classe: "bg-primary" },
  { nom: "Marine", classe: "bg-navy" },
  { nom: "Fond", classe: "bg-background border" },
  { nom: "Muet", classe: "bg-muted border" },
  { nom: "Succès", classe: "bg-success" },
  { nom: "Alerte", classe: "bg-warning" },
  { nom: "Erreur", classe: "bg-destructive" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Lot 1 · Socle
        </p>
        <h1 className="text-3xl font-bold">E-School Groupe</h1>
        <p className="text-muted-foreground">
          Aperçu de la charte graphique (page temporaire).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Couleurs</CardTitle>
          <CardDescription>Bleu · Blanc · Gris, via variables.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {couleurs.map((c) => (
            <div key={c.nom} className="flex flex-col items-center gap-1">
              <div className={`size-12 rounded-lg ${c.classe}`} />
              <span className="text-muted-foreground text-xs">{c.nom}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boutons et statuts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Button>
              <Check /> Valider
            </Button>
            <Button variant="navy">Pointer ma présence</Button>
            <Button variant="outline">Exporter PDF</Button>
            <Button variant="destructive">Refuser</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">
              <Check className="mr-1 size-3" /> À l&apos;heure
            </Badge>
            <Badge variant="warning">
              <Clock className="mr-1 size-3" /> Retard
            </Badge>
            <Badge variant="destructive">
              <Wrench className="mr-1 size-3" /> Urgent
            </Badge>
            <Badge variant="neutral">Programmé</Badge>
            <Badge>À viser</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formulaire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="ecole">Nom de l&apos;école</Label>
          <Input id="ecole" placeholder="Ex. : Campus Dakar-Plateau" />
        </CardContent>
      </Card>
    </main>
  );
}
