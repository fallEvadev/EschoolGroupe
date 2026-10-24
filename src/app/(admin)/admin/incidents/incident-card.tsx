"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildClaudeReport,
  INCIDENT_STATUS_BADGE,
  INCIDENT_STATUS_LABELS,
  type IncidentStatus,
  type IncidentView,
} from "@/lib/incidents";

import { sendTestIncident, setIncidentStatus } from "./actions";

/** Un incident : ce qui s'est passé, où, et les boutons de suivi. */
export function IncidentCard({
  incident,
  seenFirst,
  seenLast,
}: {
  incident: IncidentView;
  /** Dates déjà formatées (heure de Dakar) par le serveur. */
  seenFirst: string;
  seenLast: string;
}) {
  const [pending, startTransition] = useTransition();

  function change(status: IncidentStatus) {
    startTransition(async () => {
      const result = await setIncidentStatus({ id: incident.id, status });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  // Le texte est construit ici avec les dates déjà formatées par le serveur.
  const report = buildClaudeReport(incident, (iso) =>
    iso === incident.firstSeenAt ? seenFirst : seenLast,
  );

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words">{incident.message}</p>
          <p className="text-muted-foreground text-sm break-all">
            {incident.routePath}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={INCIDENT_STATUS_BADGE[incident.status]}>
            {INCIDENT_STATUS_LABELS[incident.status]}
          </Badge>
          <Badge variant="neutral">
            {incident.occurrences} fois
          </Badge>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Première fois</dt>
          <dd>{seenFirst}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dernière fois</dt>
          <dd>{seenLast}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Profil de la personne</dt>
          <dd>{incident.userRole ?? "Inconnu"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Code affiché à l&apos;écran</dt>
          <dd className="font-mono">{incident.digest ?? "Aucun"}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <CopyButton value={report} label="Copier pour Claude" />
        {incident.status !== "en_cours" && incident.status !== "resolu" && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => change("en_cours")}
          >
            Prendre en charge
          </Button>
        )}
        {incident.status !== "resolu" ? (
          <Button size="sm" disabled={pending} onClick={() => change("resolu")}>
            Marquer résolu
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => change("nouveau")}
          >
            Rouvrir
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Envoie un incident de test pour vérifier que la surveillance fonctionne. */
export function TestIncidentButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await sendTestIncident();
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      {pending ? "Envoi…" : "Envoyer un incident de test"}
    </Button>
  );
}
