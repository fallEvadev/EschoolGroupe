import { Badge } from "@/components/ui/badge";

type EspaceProvisoireProps = {
  titre: string;
  role: string;
};

/** Page d'attente d'un espace, remplacée par le vrai contenu des lots suivants. */
export function EspaceProvisoire({ titre, role }: EspaceProvisoireProps) {
  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">{titre}</h1>
      <p className="text-muted-foreground">
        Connexion, contrôle d&apos;accès et navigation opérationnels. Le contenu
        de cet espace arrive dans les prochains lots.
      </p>
      <div>
        <Badge variant="success">Rôle : {role}</Badge>
      </div>
    </main>
  );
}
