import { Download } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BILAN_KIND_LABELS,
  BILAN_KINDS,
  BILAN_STATUS_LABELS,
  defaultPeriodStart,
  isBilanKind,
  periodInputValue,
  periodLabel,
  periodStartFrom,
  type BilanKind,
} from "@/lib/bilans";
import { dakarIsoDate, formatDate } from "@/lib/dates";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

import { requirePedagogyManager } from "../ecoles/access";
import { GenerateButton } from "./generate-button";

export const metadata = { title: "Bilans · E-School Groupe" };

type BilanRow = {
  id: string;
  schoolName: string;
  status: string;
  reportCount: number;
  generatedAt: string;
};

/** Bilans d'une période et nombre de rapports de chacun. Lus avec le jeton de l'utilisateur (RLS). */
async function loadBilans(
  kind: BilanKind,
  periodStart: string,
): Promise<{ bilans: BilanRow[] } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bilans")
    .select("id, school_id, status, generated_at")
    .eq("period_kind", kind)
    .eq("period_start", periodStart)
    .limit(500);
  if (error) return { error: describeSupabaseError("bilans", error).message };
  if (data.length === 0) return { bilans: [] };

  const [schools, links] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name")
      .in("id", [...new Set(data.map((b) => b.school_id))]),
    supabase
      .from("bilan_reports")
      .select("bilan_id")
      .in(
        "bilan_id",
        data.map((b) => b.id),
      )
      .limit(10000),
  ]);
  if (schools.error) {
    return { error: describeSupabaseError("schools", schools.error).message };
  }
  if (links.error) {
    return {
      error: describeSupabaseError("bilan_reports", links.error).message,
    };
  }

  const names = new Map(schools.data.map((s) => [s.id, s.name]));
  const counts = new Map<string, number>();
  for (const row of links.data) {
    counts.set(row.bilan_id, (counts.get(row.bilan_id) ?? 0) + 1);
  }

  return {
    bilans: data
      .map((b) => ({
        id: b.id,
        schoolName: names.get(b.school_id) ?? "École",
        status: b.status,
        reportCount: counts.get(b.id) ?? 0,
        generatedAt: b.generated_at,
      }))
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName, "fr")),
  };
}

export default async function BilansPage({
  searchParams,
}: PageProps<"/admin/bilans">) {
  await requirePedagogyManager();
  const params = await searchParams;

  const kind: BilanKind = isBilanKind(params.type) ? params.type : "semaine";
  const requested = typeof params.periode === "string" ? params.periode : "";
  // Période demandée, sinon la dernière période terminée.
  const periodStart =
    periodStartFrom(kind, requested) ??
    defaultPeriodStart(kind, dakarIsoDate());
  const inputValue = periodInputValue(kind, periodStart);

  const loaded = await loadBilans(kind, periodStart);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Bilans"
        description="Regroupe les rapports validés d'une période en un bilan par école. Les bilans sont d'abord des brouillons."
      />

      <Card className="p-4 sm:p-6">
        {/* Choix de la période : un formulaire simple, sans JavaScript */}
        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="type" className="text-sm font-medium">
              Type de période
            </label>
            <select
              id="type"
              name="type"
              defaultValue={kind}
              className="border-input bg-card h-11 rounded-lg border px-3 text-base md:text-sm"
            >
              {BILAN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {BILAN_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="periode" className="text-sm font-medium">
              {kind === "semaine" ? "Un jour de la semaine" : "Mois"}
            </label>
            {/* Le type du champ suit le type de période choisi ci-dessus (après « Afficher »). */}
            <input
              id="periode"
              name="periode"
              type={kind === "semaine" ? "date" : "month"}
              defaultValue={inputValue}
              className="border-input bg-card h-11 rounded-lg border px-3 text-base md:text-sm"
            />
          </div>
          <button
            type="submit"
            className="hover:bg-muted h-11 rounded-lg border px-4 text-sm font-medium"
          >
            Afficher
          </button>
        </form>
      </Card>

      <Card className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {periodLabel(kind, periodStart)}
            </h2>
            <p className="text-muted-foreground text-sm">
              Seuls les rapports validés par la Direction sont inclus.
            </p>
          </div>
          <GenerateButton
            kind={kind}
            value={inputValue}
            hasBilans={"bilans" in loaded && loaded.bilans.length > 0}
          />
        </div>

        {"error" in loaded ? (
          <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
            {loaded.error}
          </p>
        ) : loaded.bilans.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun bilan pour cette période. Cliquez sur « Générer les bilans » :
            un bilan sera créé pour chaque école qui a des rapports validés.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-xl border">
            {loaded.bilans.map((bilan) => (
              <li
                key={bilan.id}
                className="flex flex-wrap items-center gap-3 p-3 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">
                    {bilan.schoolName}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {bilan.reportCount} rapport
                    {bilan.reportCount > 1 ? "s" : ""} validé
                    {bilan.reportCount > 1 ? "s" : ""} · généré le{" "}
                    {formatDate(bilan.generatedAt)}
                  </p>
                </div>
                <Badge
                  variant={bilan.status === "publie" ? "success" : "neutral"}
                >
                  {BILAN_STATUS_LABELS[bilan.status] ?? bilan.status}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  {/* Téléchargement d'un fichier : un lien classique, pas une page Next. */}
                  <a href={`/admin/bilans/${bilan.id}/word`} download>
                    <Download aria-hidden />
                    Télécharger le Word
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
