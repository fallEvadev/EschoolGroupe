import "server-only";

import { parseRole, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/dates";
import {
  createAdminSupabase,
  isAdminSupabaseConfigured,
} from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const LIMIT = 50;

/** Libellés lisibles des actions enregistrées. */
const ACTION_LABELS: Record<string, string> = {
  role_changed: "Rôle modifié",
  account_deactivated: "Compte désactivé",
  account_reactivated: "Compte réactivé",
  account_archived: "Compte archivé",
  settings_updated: "Paramètres modifiés",
};

function roleLabel(value: Json | undefined): string {
  const role = parseRole(value);
  return role ? ROLE_LABELS[role] : "aucun";
}

/** Précision affichée sous l'action (ex. ancien → nouveau rôle). */
function describe(action: string, details: Json): string | null {
  if (typeof details !== "object" || details === null || Array.isArray(details))
    return null;
  if (action === "role_changed") {
    return `${roleLabel(details.from)} → ${roleLabel(details.to)}`;
  }
  if (action === "settings_updated") {
    return `${details.organization_name} · ${details.academic_year} · semestre ${details.current_semester}`;
  }
  if (action === "account_archived" && details.source === "clerk_webhook") {
    return "Compte supprimé dans Clerk";
  }
  return null;
}

/** Les dernières actions sensibles (lecture réservée au Super-Admin). */
export async function AuditLogList() {
  if (!isAdminSupabaseConfigured()) {
    return (
      <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
        Journal indisponible tant que la configuration Supabase est incomplète.
      </p>
    );
  }
  const supabase = createAdminSupabase();
  const { data: entries, error } = await supabase
    .from("audit_log")
    .select(
      "id, actor_clerk_id, action, entity, entity_id, details, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error("audit_log :", error.message);
    return (
      <p className="text-destructive text-sm">
        Impossible de charger le journal d&apos;audit.
      </p>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune action enregistrée pour le moment.
      </p>
    );
  }

  // Noms des personnes citées (auteurs et comptes concernés).
  const clerkIds = new Set<string>();
  for (const entry of entries) {
    if (entry.actor_clerk_id) clerkIds.add(entry.actor_clerk_id);
    if (entry.entity === "profiles" && entry.entity_id)
      clerkIds.add(entry.entity_id);
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("clerk_user_id, full_name")
    .in("clerk_user_id", [...clerkIds]);
  const names = new Map(
    (profiles ?? []).map((p) => [p.clerk_user_id, p.full_name]),
  );
  const nameOf = (id: string) => names.get(id) ?? "Compte inconnu";

  return (
    <ul className="divide-border divide-y">
      {entries.map((entry) => {
        const detail = describe(entry.action, entry.details);
        return (
          <li key={entry.id} className="flex flex-col gap-1 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-medium">
                {ACTION_LABELS[entry.action] ?? entry.action}
                {entry.entity === "profiles" && entry.entity_id && (
                  <span className="font-normal">
                    {" "}
                    : {nameOf(entry.entity_id)}
                  </span>
                )}
              </p>
              <time
                dateTime={entry.created_at}
                className="text-muted-foreground text-sm tabular-nums"
              >
                {formatDateTime(entry.created_at)}
              </time>
            </div>
            {detail && <p className="text-sm">{detail}</p>}
            <p className="text-muted-foreground text-sm">
              Par{" "}
              {entry.actor_clerk_id
                ? nameOf(entry.actor_clerk_id)
                : "le système"}
            </p>
          </li>
        );
      })}
      {entries.length === LIMIT && (
        <li className="text-muted-foreground py-3 text-sm">
          Seules les {LIMIT} dernières actions sont affichées.
        </li>
      )}
    </ul>
  );
}
