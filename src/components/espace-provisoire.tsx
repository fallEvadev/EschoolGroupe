import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

type EspaceProvisoireProps = {
  titre: string;
  role: string;
};

/** Page d'attente d'un espace, remplacée par le vrai contenu des lots suivants. */
export function EspaceProvisoire({ titre, role }: EspaceProvisoireProps) {
  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Bientôt disponible"
        title={titre}
        description="Connexion, contrôle d'accès et navigation opérationnels. Le contenu de cet espace arrive dans les prochains lots."
      />
      <div>
        <Badge variant="success">Rôle : {role}</Badge>
      </div>
    </main>
  );
}
