import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PointedStatus } from "@/components/pointed-status";
import { Card } from "@/components/ui/card";
import { slotAvailability } from "@/lib/agenda";
import { formatMinutes } from "@/lib/attendance";
import { requireSpace } from "@/lib/auth/guards";
import { dakarIsoWeekday, dakarMinutes } from "@/lib/dates";
import { loadAgenda } from "@/lib/formateur-agenda";
import { formatTime, isWeekday, WEEKDAY_LABELS } from "@/lib/schools";

import { PointageForm } from "./pointage-form";

export const metadata = { title: "Pointer · E-School Groupe" };

/** Carte d'information simple (pointage impossible, déjà fait…). */
function Notice({ children }: { children: React.ReactNode }) {
  return <Card className="p-4 text-sm sm:p-6">{children}</Card>;
}

export default async function PointagePage({
  searchParams,
}: PageProps<"/formateur/pointage">) {
  await requireSpace("formateur");
  const params = await searchParams;
  const slotId = typeof params.creneau === "string" ? params.creneau : "";

  const agenda = await loadAgenda();
  const now = new Date();
  const slot =
    "error" in agenda ? undefined : agenda.slots.find((s) => s.id === slotId);

  let content: React.ReactNode;
  if ("error" in agenda) {
    content = (
      <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
        {agenda.error}
      </p>
    );
  } else if (!slot || agenda.fullName === null) {
    content = (
      <Notice>
        Ce créneau est introuvable dans votre planning. Retournez à
        l&apos;accueil et choisissez un créneau.
      </Notice>
    );
  } else if (slot.weekday !== dakarIsoWeekday(now)) {
    const day = isWeekday(slot.weekday)
      ? WEEKDAY_LABELS[slot.weekday].toLowerCase()
      : "un autre jour";
    content = (
      <Notice>Ce créneau a lieu le {day}, pas aujourd&apos;hui.</Notice>
    );
  } else {
    const availability = slotAvailability({
      slot,
      nowMinutes: dakarMinutes(now),
      attendance: agenda.todayAttendances.get(slot.id),
    });
    const timeLabel = `${formatTime(slot.startsAt)}–${formatTime(slot.endsAt)}`;

    if (availability.kind === "pointed") {
      content = (
        <Notice>
          <div className="flex flex-col gap-3">
            <p className="font-medium">Vous avez déjà pointé sur ce créneau.</p>
            <PointedStatus attendance={availability} />
          </div>
        </Notice>
      );
    } else if (availability.kind === "upcoming") {
      content = (
        <Notice>
          Le pointage ouvre à {formatMinutes(availability.opensAtMinutes)}.
        </Notice>
      );
    } else if (availability.kind === "missed") {
      content = (
        <Notice>
          Ce créneau est terminé. Si vous étiez présent, contactez la Direction
          pédagogique.
        </Notice>
      );
    } else {
      content = (
        <PointageForm
          slotId={slot.id}
          fullName={agenda.fullName}
          schoolName={slot.schoolName}
          timeLabel={timeLabel}
        />
      );
    }
  }

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <Link
        href="/formateur"
        className="text-primary flex w-fit items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Accueil
      </Link>
      <PageHeader eyebrow="Pointage" title="Pointer ma présence" />
      {content}
    </main>
  );
}
