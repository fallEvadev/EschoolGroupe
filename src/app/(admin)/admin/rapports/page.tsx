import { PageHeader } from "@/components/layout/page-header";
import { ReportContentView } from "@/components/report-content-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatIsoLongDate } from "@/lib/dates";
import {
  REPORT_BADGE,
  REPORT_LABELS,
  REVISION_LABELS,
  type ReviewItem,
} from "@/lib/reports";
import { loadReviewQueue } from "@/lib/reports-data";
import { formatTime } from "@/lib/schools";

import { requirePedagogyManager } from "../ecoles/access";
import { ReviewPanel } from "./review-panel";

export const metadata = { title: "Rapports · E-School Groupe" };

function ReportHeader({ item }: { item: ReviewItem }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{item.formateurName}</p>
        <Badge variant={REPORT_BADGE[item.status]}>
          {REPORT_LABELS[item.status]}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        <span className="first-letter:uppercase">
          {formatIsoLongDate(item.date)}
        </span>{" "}
        · {item.schoolName}
        {item.startsAt &&
          ` · ${formatTime(item.startsAt)}–${formatTime(item.endsAt)}`}
      </p>
    </div>
  );
}

/** Historique du rapport : envois, décisions et commentaires. */
function History({ item }: { item: ReviewItem }) {
  if (item.history.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="text-primary cursor-pointer font-medium">
        Historique ({item.history.length})
      </summary>
      <ol className="mt-2 flex flex-col gap-2">
        {item.history.map((entry) => (
          <li key={entry.version}>
            <span className="font-medium">
              {REVISION_LABELS[entry.kind] ?? entry.kind}
            </span>{" "}
            <span className="text-muted-foreground">
              · {formatDateTime(entry.createdAt)}
            </span>
            {entry.comment && (
              <p className="whitespace-pre-wrap">{entry.comment}</p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

export default async function RapportsPage() {
  await requirePedagogyManager();
  const loaded = await loadReviewQueue();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Pédagogie"
        title="Rapports journaliers"
        description="Validez les rapports des formateurs, corrigez-les ou demandez une modification."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              À traiter ({loaded.pending.length})
            </h2>
            {loaded.pending.length === 0 ? (
              <Card className="text-muted-foreground p-4 text-sm sm:p-6">
                Aucun rapport en attente.
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {loaded.pending.map((item) => (
                  <li key={item.id}>
                    <Card className="flex flex-col gap-4 p-4 sm:p-5">
                      <ReportHeader item={item} />
                      <ReportContentView content={item.content} />
                      <History item={item} />
                      <ReviewPanel reportId={item.id} content={item.content} />
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {loaded.decided.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Dernières décisions</h2>
              <ul className="flex flex-col gap-3">
                {loaded.decided.map((item) => (
                  <li key={item.id}>
                    <Card className="flex flex-col gap-3 p-4">
                      <ReportHeader item={item} />
                      {item.reviewComment && (
                        <p className="text-sm whitespace-pre-wrap">
                          <span className="text-muted-foreground">
                            Commentaire :{" "}
                          </span>
                          {item.reviewComment}
                        </p>
                      )}
                      <details className="text-sm">
                        <summary className="text-primary cursor-pointer font-medium">
                          Voir le rapport
                        </summary>
                        <div className="mt-3">
                          <ReportContentView content={item.content} />
                        </div>
                      </details>
                      <History item={item} />
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
