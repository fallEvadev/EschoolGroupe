import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatIsoLongDate } from "@/lib/dates";
import {
  REPORT_BADGE,
  reportStateLabel,
  type ReportListItem,
} from "@/lib/reports";
import { loadReportList } from "@/lib/reports-data";
import { formatTime } from "@/lib/schools";

export const metadata = { title: "Cahiers · E-School Groupe" };

function ReportRow({ item }: { item: ReportListItem }) {
  const variant = item.report ? REPORT_BADGE[item.report.status] : "warning";
  return (
    <li>
      <Link
        href={`/formateur/cahiers/${item.attendanceId}`}
        className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <Card className="hover:bg-accent/40 flex flex-col gap-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-semibold first-letter:uppercase">
              {formatIsoLongDate(item.date)}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {item.schoolName}
              {item.startsAt &&
                ` · ${formatTime(item.startsAt)}–${formatTime(item.endsAt)}`}
            </p>
          </div>
          <Badge variant={variant} className="w-fit">
            {reportStateLabel(item)}
          </Badge>
        </Card>
      </Link>
    </li>
  );
}

export default async function CahiersPage() {
  await requireSpace("formateur");
  const loaded = await loadReportList();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Espace formateur"
        title="Mes rapports"
        description="Un rapport par pointage : classes, thème du cours et état du matériel."
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.items.length === 0 ? (
        <Card className="text-muted-foreground p-4 text-sm sm:p-6">
          Aucun pointage ces 30 derniers jours. Votre rapport apparaîtra ici
          après votre pointage.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {loaded.items.map((item) => (
            <ReportRow key={item.attendanceId} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
