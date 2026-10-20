import { Download, FileText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatFileSize } from "@/lib/bilan-pdf";
import { bilanTitle, isBilanKind, periodLabel } from "@/lib/bilans";
import { formatDate } from "@/lib/dates";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const metadata = { title: "Bilans · E-School" };

type PartnerBilan = {
  id: string;
  schoolName: string;
  label: string;
  title: string;
  publishedAt: string;
  sizeBytes: number;
};

/**
 * Bilans publiés des écoles du directeur connecté. La fonction SQL
 * `partner_bilans` ne renvoie que les bilans publiés, avec leur PDF, des écoles
 * auxquelles il est rattaché : il n'a aucun accès direct à la table.
 */
async function loadPartnerBilans(): Promise<
  { bilans: PartnerBilan[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("partner_bilans");
  if (error) {
    return { error: describeSupabaseError("partner_bilans", error).message };
  }

  return {
    bilans: data.flatMap((row) =>
      isBilanKind(row.out_period_kind) && row.out_published_at
        ? [
            {
              id: row.out_id,
              schoolName: row.out_school_name,
              label: periodLabel(row.out_period_kind, row.out_period_start),
              title: bilanTitle(row.out_period_kind),
              publishedAt: row.out_published_at,
              sizeBytes: row.out_pdf_size_bytes ?? 0,
            },
          ]
        : [],
    ),
  };
}

export default async function PartnerBilansPage() {
  await requireSpace("partenaire");
  const loaded = await loadPartnerBilans();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Portail partenaire"
        title="Bilans"
        description="Les bilans de votre école, remis par E-School : un document par semaine ou par mois."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.bilans.length === 0 ? (
        <Card className="text-muted-foreground p-6 text-center text-sm">
          Aucun bilan n&apos;est encore disponible. Vous serez prévenu dès
          qu&apos;un bilan de votre école sera publié.
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {loaded.bilans.map((bilan) => (
            <li key={bilan.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <span
                  aria-hidden
                  className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
                >
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">
                    {bilan.title} · {bilan.schoolName}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {bilan.label} · publié le {formatDate(bilan.publishedAt)}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  {/* Téléchargement d'un fichier : un lien classique, pas une page Next. */}
                  <a href={`/partenaire/bilans/${bilan.id}/pdf`}>
                    <Download aria-hidden />
                    Télécharger le PDF
                    {bilan.sizeBytes > 0 &&
                      ` (${formatFileSize(bilan.sizeBytes)})`}
                  </a>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
