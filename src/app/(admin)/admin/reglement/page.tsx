import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { RULES_REQUIRED_ROLES, staffMissingAcceptance } from "@/lib/rules";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";

import { requireStaffManager } from "../personnel/access";
import { PublishRulesForm } from "./publish-rules-form";

export const metadata = { title: "Règlement intérieur · E-School Groupe" };

const HISTORY_LIMIT = 20;

type Version = {
  id: string;
  version: number;
  title: string;
  content: string;
  published_at: string;
};

type Follow = {
  concerned: number;
  accepted: number;
  missing: { id: string; full_name: string }[];
};

async function loadRules(): Promise<
  { versions: Version[]; follow: Follow | null } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  // Client avec le jeton de l'utilisateur : la RLS limite la lecture des
  // acceptations de tous aux RH et au Super-Admin.
  const supabase = await createServerSupabase();

  const { data: versions, error } = await supabase
    .from("internal_rules")
    .select("id, version, title, content, published_at")
    .order("version", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    return { error: describeSupabaseError("internal_rules", error).message };
  }

  const current = versions[0];
  if (!current) return { versions, follow: null };

  const [staffResult, acceptedResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, status")
      .in("role", [...RULES_REQUIRED_ROLES])
      .eq("status", "actif")
      .order("full_name")
      .limit(500),
    supabase
      .from("document_acceptances")
      .select("profile_id")
      .eq("rules_id", current.id)
      .limit(5000),
  ]);
  // Un test par requête : TypeScript sait alors que `data` est bien présent.
  if (staffResult.error) {
    return {
      error: describeSupabaseError("profiles", staffResult.error).message,
    };
  }
  if (acceptedResult.error) {
    return {
      error: describeSupabaseError("document_acceptances", acceptedResult.error)
        .message,
    };
  }

  const accepted = new Set(acceptedResult.data.map((row) => row.profile_id));
  const missing = staffMissingAcceptance(staffResult.data, accepted);
  const concerned = staffResult.data.length;
  return {
    versions,
    follow: { concerned, accepted: concerned - missing.length, missing },
  };
}

export default async function ReglementAdminPage() {
  await requireStaffManager();
  const loaded = await loadRules();

  return (
    <main className="flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Organisation · RH"
        title="Règlement intérieur"
        description="Publiez une nouvelle version et suivez qui l'a acceptée. Les formateurs et maintenanciers doivent accepter la version en vigueur avant d'utiliser la plateforme."
        actions={
          <Button variant="outline" asChild>
            <Link href="/reglement">Voir la page du personnel</Link>
          </Button>
        }
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <>
          {loaded.follow && loaded.versions[0] && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Version en vigueur : {loaded.versions[0].version}
                </CardTitle>
                <CardDescription>
                  {loaded.versions[0].title} · publiée le{" "}
                  {formatDate(loaded.versions[0].published_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-lg font-semibold tabular-nums">
                  {loaded.follow.accepted} / {loaded.follow.concerned} comptes
                  actifs concernés ont accepté
                </p>
                {loaded.follow.missing.length === 0 ? (
                  <p className="text-success flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="size-5" aria-hidden />
                    {loaded.follow.concerned === 0
                      ? "Aucun compte actif concerné pour le moment."
                      : "Tout le monde a accepté cette version."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm">
                      En attente d&apos;acceptation :
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {loaded.follow.missing.map((person) => (
                        <li key={person.id}>
                          <Link
                            href={`/admin/personnel?fiche=${person.id}`}
                            className="hover:underline"
                          >
                            <Badge variant="warning">{person.full_name}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {loaded.versions.length === 0
                  ? "Publier le premier règlement"
                  : "Publier une nouvelle version"}
              </CardTitle>
              <CardDescription>
                {loaded.versions.length === 0
                  ? "Tant qu'aucun règlement n'est publié, personne n'est bloqué."
                  : "Le texte en vigueur est pré-rempli : modifiez-le puis publiez. Tout le personnel concerné devra accepter la nouvelle version."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PublishRulesForm
                // La clé relance le formulaire avec la nouvelle version après publication.
                key={loaded.versions[0]?.id ?? "premiere"}
                initial={{
                  title:
                    loaded.versions[0]?.title ??
                    "Règlement intérieur du personnel",
                  content: loaded.versions[0]?.content ?? "",
                }}
              />
            </CardContent>
          </Card>

          {loaded.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historique des versions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-border divide-y">
                  {loaded.versions.map((version, index) => (
                    <li
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <p className="font-medium">
                        Version {version.version} · {version.title}
                      </p>
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <Badge variant="success">En vigueur</Badge>
                        )}
                        <span className="text-muted-foreground text-sm">
                          {formatDate(version.published_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
