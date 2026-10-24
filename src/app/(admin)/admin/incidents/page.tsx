import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/dates";
import {
  isIncidentStatus,
  sortIncidents,
  type IncidentView,
} from "@/lib/incidents";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

import { IncidentCard, TestIncidentButton } from "./incident-card";

export const metadata = { title: "Incidents · E-School" };

/** Nombre maximal d'incidents affichés (les plus récents). */
const MAX_INCIDENTS = 100;

async function loadIncidents(): Promise<
  { items: IncidentView[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
    };
  }
  // Lecture avec le jeton du Super-Admin : la RLS réserve la table à son rôle.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("incident_reports")
    .select(
      "id, source, route_path, request_path, route_type, message, digest, stack, user_role, user_agent, status, occurrences, first_seen_at, last_seen_at, note",
    )
    .order("last_seen_at", { ascending: false })
    .limit(MAX_INCIDENTS);
  if (error) {
    return { error: describeSupabaseError("incident_reports", error).message };
  }

  return {
    items: data.flatMap((row) =>
      isIncidentStatus(row.status)
        ? [
            {
              id: row.id,
              source: row.source,
              routePath: row.route_path,
              requestPath: row.request_path,
              routeType: row.route_type,
              message: row.message,
              digest: row.digest,
              stack: row.stack,
              userRole: row.user_role,
              userAgent: row.user_agent,
              status: row.status,
              occurrences: row.occurrences,
              firstSeenAt: row.first_seen_at,
              lastSeenAt: row.last_seen_at,
              note: row.note,
            },
          ]
        : [],
    ),
  };
}

/**
 * Incidents de la plateforme (Super-Admin seulement) : les erreurs captées
 * automatiquement. « Copier pour Claude » donne le texte à coller dans la
 * conversation pour retrouver le fichier et la cause.
 */
export default async function IncidentsPage() {
  const role = await requireSpace("admin");
  if (role !== "super_admin") redirect("/non-autorise");

  const loaded = await loadIncidents();
  const items = "items" in loaded ? sortIncidents(loaded.items) : [];
  const open = items.filter((item) => item.status !== "resolu").length;

  return (
    <main className="flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Surveillance"
        title="Incidents"
        description="Les erreurs de la plateforme sont enregistrées toutes seules, et vous recevez une notification à la première apparition. Cliquez sur « Copier pour Claude » puis collez le texte dans la conversation : il retrouvera le fichier et la cause."
        actions={<TestIncidentButton />}
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground">
            Aucun incident enregistré. C&apos;est bon signe : aucune erreur n&apos;a
            été détectée sur la plateforme.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {open === 0
              ? "Tous les incidents sont résolus."
              : `${open} incident(s) à traiter.`}
          </p>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <IncidentCard
                  incident={item}
                  seenFirst={formatDateTime(item.firstSeenAt)}
                  seenLast={formatDateTime(item.lastSeenAt)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
