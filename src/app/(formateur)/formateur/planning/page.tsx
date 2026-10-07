import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { groupByWeekday } from "@/lib/agenda";
import { requireSpace } from "@/lib/auth/guards";
import { dakarIsoWeekday } from "@/lib/dates";
import { loadAgenda } from "@/lib/formateur-agenda";
import { formatTime, WEEKDAY_LABELS } from "@/lib/schools";

export const metadata = { title: "Planning · E-School Groupe" };

export default async function PlanningPage() {
  await requireSpace("formateur");
  const agenda = await loadAgenda();
  const today = dakarIsoWeekday();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Espace formateur"
        title="Mon planning"
        description="Vos créneaux de la semaine, par école. Ils se répètent chaque semaine."
      />

      {"error" in agenda ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {agenda.error}
        </p>
      ) : agenda.slots.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <p className="text-muted-foreground">
            Aucun créneau ne vous est affecté pour le moment. La Direction
            pédagogique vous en affectera.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groupByWeekday(agenda.slots).map((group) => (
            <section key={group.weekday} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {WEEKDAY_LABELS[group.weekday]}
                {group.weekday === today && <Badge>Aujourd&apos;hui</Badge>}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.slots.map((slot) => (
                  <li key={slot.id}>
                    <Card className="flex flex-col gap-1 p-4">
                      <p className="font-heading text-lg font-bold tabular-nums">
                        {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
                        {slot.label && (
                          <span className="text-muted-foreground font-sans text-sm font-normal">
                            {" "}
                            · {slot.label}
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-sm">
                        <MapPin className="size-4 shrink-0" aria-hidden />
                        {slot.schoolName}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
