import { Badge } from "@/components/ui/badge";
import type { SlotAttendance } from "@/lib/agenda";
import {
  effectiveState,
  ROW_STATE_BADGE,
  ROW_STATE_LABELS,
} from "@/lib/attendance-sheet";
import { formatClock } from "@/lib/dates";

/**
 * État d'un pointage pour le formateur : le statut APRÈS la décision de la
 * Direction (« Refusé » compte comme une absence), l'heure, et le motif.
 */
export function PointedStatus({ attendance }: { attendance: SlotAttendance }) {
  const state = effectiveState(
    { status: attendance.status, lateMinutes: attendance.lateMinutes ?? 0 },
    attendance.review ?? null,
  );
  const { review } = attendance;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ROW_STATE_BADGE[state]}>
          {ROW_STATE_LABELS[state]}
        </Badge>
        <span className="text-muted-foreground text-sm">
          pointé à {formatClock(attendance.recordedAt)}
        </span>
      </div>
      {review ? (
        <p className="text-sm">
          {review.decision === "valide"
            ? "Validé par la Direction."
            : "Refusé par la Direction. Ce pointage compte comme une absence."}
          {review.comment ? ` Motif : ${review.comment}` : ""}
        </p>
      ) : (
        attendance.status === "a_verifier" && (
          <p className="text-muted-foreground text-sm">
            La Direction va vérifier votre présence.
          </p>
        )
      )}
    </div>
  );
}
