import "server-only";

import { parseRole, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DOCUMENT_LABELS, isDocumentKind } from "@/lib/staff-documents";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";
import type { Json } from "@/types/database";

const LIMIT = 50;

/** Identifiant de fiche (uuid), par opposition à un identifiant Clerk. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Libellés lisibles des actions enregistrées. */
const ACTION_LABELS: Record<string, string> = {
  role_changed: "Rôle modifié",
  account_deactivated: "Compte désactivé",
  account_reactivated: "Compte réactivé",
  account_archived: "Compte archivé",
  settings_updated: "Paramètres modifiés",
  staff_created: "Fiche créée",
  staff_updated: "Fiche modifiée",
  invitation_resent: "Invitation renvoyée",
  account_activated: "Compte activé",
  document_uploaded: "Document ajouté",
  document_viewed: "Document consulté",
  document_reviewed: "Document contrôlé",
  rules_published: "Règlement publié",
  rules_accepted: "Règlement accepté",
  school_created: "École créée",
  school_updated: "École modifiée",
  school_archived: "École archivée",
  school_restored: "École restaurée",
  director_linked: "Directeur rattaché",
  director_unlinked: "Directeur retiré",
  slot_created: "Créneau ajouté",
  slot_archived: "Créneau archivé",
  slot_assigned: "Formateur affecté",
  slot_unassigned: "Formateur retiré",
  codes_generated: "Codes du jour générés",
  code_regenerated: "Code régénéré",
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
  if (action === "staff_created") {
    return `${details.email} · ${roleLabel(details.role)} · invitation envoyée`;
  }
  if (action === "document_reviewed") {
    const kind = typeof details.kind === "string" ? details.kind : "";
    const label = isDocumentKind(kind) ? DOCUMENT_LABELS[kind] : "Document";
    const decision = details.decision === "valide" ? "validé" : "rejeté";
    const reason =
      typeof details.reason === "string" && details.reason
        ? ` · Motif : ${details.reason}`
        : "";
    return `${label} · ${details.file_name} · ${decision}${reason}`;
  }
  if (action === "document_uploaded" || action === "document_viewed") {
    const kind = typeof details.kind === "string" ? details.kind : "";
    const label = isDocumentKind(kind) ? DOCUMENT_LABELS[kind] : "Document";
    return `${label} · ${details.file_name}`;
  }
  if (
    action === "school_created" ||
    action === "school_updated" ||
    action === "school_archived" ||
    action === "school_restored"
  ) {
    return `${details.name}`;
  }
  if (action === "codes_generated") {
    return `${details.created} code(s) · ${formatDate(String(details.date))}`;
  }
  if (action === "code_regenerated") {
    return `${details.school} · ${formatDate(String(details.date))}`;
  }
  if (action === "director_linked") return `${details.director}`;
  if (action === "slot_created" || action === "slot_archived") {
    return details.school
      ? `${details.school} · ${details.slot}`
      : `${details.slot}`;
  }
  if (action === "slot_assigned")
    return `${details.formateur} · ${details.slot}`;
  if (action === "rules_published") {
    return `Version ${details.version} · ${details.title}`;
  }
  if (action === "rules_accepted") return `Version ${details.version}`;
  if (action === "invitation_resent" || action === "account_activated") {
    return `${details.email}`;
  }
  if (action === "account_archived" && details.source === "clerk_webhook") {
    return "Compte supprimé dans Clerk";
  }
  if (typeof details.reason === "string" && details.reason) {
    return `Motif : ${details.reason}`;
  }
  return null;
}

/** Les dernières actions sensibles (lecture réservée au Super-Admin). */
export async function AuditLogList() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
        Journal indisponible tant que la configuration Supabase est incomplète.
      </p>
    );
  }
  // Client avec le jeton de l'utilisateur : la RLS réserve la lecture au Super-Admin.
  const supabase = await createServerSupabase();
  const { data: entries, error } = await supabase
    .from("audit_log")
    .select(
      "id, actor_clerk_id, action, entity, entity_id, details, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    return (
      <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
        {describeSupabaseError("audit_log", error).message}
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

  // Noms des personnes citées : auteurs (identifiant Clerk) et fiches
  // concernées (identifiant Clerk, ou identifiant de fiche pour les recrues).
  const clerkIds = new Set<string>();
  const profileIds = new Set<string>();
  for (const entry of entries) {
    if (entry.actor_clerk_id) clerkIds.add(entry.actor_clerk_id);
    if (entry.entity === "profiles" && entry.entity_id) {
      if (UUID_PATTERN.test(entry.entity_id)) profileIds.add(entry.entity_id);
      else clerkIds.add(entry.entity_id);
    }
  }
  const [byClerkId, byProfileId] = await Promise.all([
    supabase
      .from("profiles")
      .select("clerk_user_id, full_name")
      .in("clerk_user_id", [...clerkIds]),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...profileIds]),
  ]);
  const names = new Map<string, string>();
  for (const p of byClerkId.data ?? []) {
    if (p.clerk_user_id) names.set(p.clerk_user_id, p.full_name);
  }
  for (const p of byProfileId.data ?? []) names.set(p.id, p.full_name);
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
