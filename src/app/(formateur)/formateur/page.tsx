import { CalendarDays, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { slotAvailability, slotsForWeekday } from "@/lib/agenda";
import {
  ATTENDANCE_BADGE,
  ATTENDANCE_LABELS,
  formatMinutes,
} from "@/lib/attendance";
import { requireSpace } from "@/lib/auth/guards";
import {
  dakarIsoWeekday,
  dakarMinutes,
  formatClock,
  formatLongDate,
} from "@/lib/dates";
import { formatTime } from "@/lib/schools";
import { loadAgenda } from "@/lib/formateur-agenda";
import { splitFullName } from "@/lib/staff";

export const metadata = { title: "Accueil · E-School Groupe" };

export default async function FormateurPage() {
  await requireSpace("formateur");
  const agenda = await loadAgenda();

  const now = new Date();
  const firstName =
    "error" in agenda || !agenda.fullName
      ? null
      : splitFullName(agenda.fullName).firstName;

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Espace formateur"
        title={firstName ? `Bonjour ${firstName}` : "Bonjour"}
        description={`Aujourd'hui : ${formatLongDate(now)}.`}
      />

      {"error" in agenda ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {agenda.error}
        </p>
      ) : (
        <TodaySlots agenda={agenda} now={now} />
      )}

      <div>
        <Button variant="outline" asChild>
          <Link href="/formateur/planning">
            <CalendarDays aria-hidden />
            Voir mon planning de la semaine
          </Link>
        </Button>
      </div>
    </main>
  );
}

function TodaySlots({
  agenda,
  now,
}: {
  agenda: Exclude<Awaited<ReturnType<typeof loadAgenda>>, { error: string }>;
  now: Date;
}) {
  const slots = slotsForWeekday(agenda.slots, dakarIsoWeekday(now));
  const nowMinutes = dakarMinutes(now);

  if (agenda.fullName === null) {
    return (
      <Card className="p-4 text-sm sm:p-6">
        <p className="text-muted-foreground">
          Aucune fiche de formateur n&apos;est liée à ce compte : il n&apos;a ni
          planning ni pointage.
        </p>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="text-muted-foreground">
          Aucun créneau prévu aujourd&apos;hui.
        </p>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Créneaux du jour">
      <h2 className="text-lg font-semibold">
        Mes créneaux d&apos;aujourd&apos;hui
      </h2>
      <ul className="flex flex-col gap-3">
        {slots.map((slot) => {
          const availability = slotAvailability({
            slot,
            nowMinutes,
            attendance: agenda.todayAttendances.get(slot.id),
          });
          return (
            <li key={slot.id}>
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <p className="font-heading text-xl font-bold tabular-nums">
                    {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
                  </p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    {slot.schoolName}
                  </p>
                  {slot.label && (
                    <p className="text-muted-foreground text-sm">
                      {slot.label}
                    </p>
                  )}
                </div>

                {availability.kind === "pointed" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ATTENDANCE_BADGE[availability.status]}>
                      {ATTENDANCE_LABELS[availability.status]}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      pointé à {formatClock(availability.recordedAt)}
                    </span>
                  </div>
                )}
                {availability.kind === "open" && (
                  <Button asChild size="lg">
                    <Link href={`/formateur/pointage?creneau=${slot.id}`}>
                      Pointer ma présence
                    </Link>
                  </Button>
                )}
                {availability.kind === "upcoming" && (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <Clock className="size-4" aria-hidden />
                    Le pointage ouvre à{" "}
                    {formatMinutes(availability.opensAtMinutes)}.
                  </p>
                )}
                {availability.kind === "missed" && (
                  <Badge variant="neutral" className="w-fit">
                    Créneau terminé, non pointé
                  </Badge>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
