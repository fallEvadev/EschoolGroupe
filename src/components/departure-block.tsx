import { CircleCheck, Clock, FileText, LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { SlotAttendance } from "@/lib/agenda";
import { departureMessage, departureStage } from "@/lib/departure";

/**
 * Ce que le formateur doit faire après son arrivée, selon l'heure : attendre la
 * fin du cours, valider sa descente avec le code du directeur (ce qui ouvre le
 * rapport), puis rédiger son rapport. Vide pour un ancien pointage.
 */
export function DepartureBlock({
  attendance,
  endsAt,
  nowMinutes,
}: {
  attendance: SlotAttendance;
  endsAt: string;
  nowMinutes: number;
}) {
  const stage = departureStage({
    requiresDeparture: attendance.requiresDeparture,
    departedAt: attendance.departedAt,
    departureSource: attendance.departureSource,
    endsAt,
    // Cette carte n'existe que pour les pointages d'aujourd'hui.
    isToday: true,
    nowMinutes,
  });
  const message = departureMessage(stage);
  if (!message) return null;

  const reportHref = `/formateur/cahiers/${attendance.attendanceId}`;
  const departureHref = `/formateur/descente/${attendance.attendanceId}`;

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        {stage.stage === "done" ? (
          <CircleCheck
            className="text-success mt-0.5 size-4 shrink-0"
            aria-hidden
          />
        ) : (
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        {message}
      </p>

      {stage.stage === "awaiting_code" && (
        <Button asChild size="lg" className="w-full">
          <Link href={departureHref}>
            <LogOut aria-hidden />
            Saisir le code de descente
          </Link>
        </Button>
      )}

      {stage.stage === "done" && (
        <Button asChild size="lg" className="w-full">
          <Link href={reportHref}>
            <FileText aria-hidden />
            Rédiger mon rapport
          </Link>
        </Button>
      )}
    </div>
  );
}
