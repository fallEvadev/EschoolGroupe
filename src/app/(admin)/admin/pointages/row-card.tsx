import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { locationSummary } from "@/lib/attendance";
import {
  canExcuse,
  ROW_STATE_BADGE,
  ROW_STATE_LABELS,
  type SheetRow,
} from "@/lib/attendance-sheet";
import { formatClock } from "@/lib/dates";
import { formatTime, mapsUrl } from "@/lib/schools";
import { formatDuration } from "@/lib/departure";

import {
  CancelExcuseButton,
  DepartureAction,
  ExcuseAction,
  ReviewActions,
} from "./sheet-actions";

export function SheetRowCard({
  row,
  name,
  school,
  today,
}: {
  row: SheetRow;
  name: string;
  school: string;
  today: string;
}) {
  const { attendance, review, excuse } = row;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          <p className="text-muted-foreground text-sm">
            {school} · {formatTime(row.startsAt)}–{formatTime(row.endsAt)}
            {row.label ? ` (${row.label})` : ""}
          </p>
        </div>
        <Badge variant={ROW_STATE_BADGE[row.state]}>
          {ROW_STATE_LABELS[row.state]}
        </Badge>
      </div>

      {attendance && (
        <p className="text-sm">
          Pointé à {formatClock(attendance.recordedAt)}
          {attendance.lateMinutes > 0
            ? ` · ${attendance.lateMinutes} min après le début`
            : ""}
          <span className="text-muted-foreground">
            {" "}
            · {locationSummary(attendance)}
          </span>
          {attendance.latitude !== null && attendance.longitude !== null && (
            <>
              {" "}
              <a
                href={mapsUrl(attendance.latitude, attendance.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Voir sur la carte
              </a>
            </>
          )}
        </p>
      )}
      {attendance?.requiresDeparture && (
        <p className="text-sm">
          {attendance.departedAt ? (
            <>
              Descente à {formatClock(attendance.departedAt)}
              {formatDuration(attendance.recordedAt, attendance.departedAt) && (
                <span className="text-muted-foreground">
                  {" "}
                  · durée{" "}
                  {formatDuration(attendance.recordedAt, attendance.departedAt)}
                </span>
              )}
              {attendance.departureSource === "direction" && (
                <span className="text-muted-foreground">
                  {" "}
                  · validée par la Direction
                  {attendance.departureReason
                    ? ` : ${attendance.departureReason}`
                    : ""}
                </span>
              )}
            </>
          ) : (
            <span className="text-warning font-medium">
              Descente non validée
            </span>
          )}
        </p>
      )}
      {review && (
        <p className="text-sm">
          <span className="font-medium">
            {review.decision === "valide"
              ? "Validé par la Direction"
              : "Refusé par la Direction"}
          </span>
          {review.comment ? ` : ${review.comment}` : ""}
        </p>
      )}
      {excuse && (
        <p className="text-sm">
          <span className="font-medium">Absence excusée</span> : {excuse.reason}
        </p>
      )}

      {(attendance?.status === "a_verifier" ||
        (canExcuse(row.state) && row.date <= today) ||
        (attendance?.requiresDeparture &&
          !attendance.departedAt &&
          row.date <= today) ||
        excuse) && (
        <div className="flex flex-wrap items-center gap-2">
          {attendance?.status === "a_verifier" && (
            <ReviewActions
              attendanceId={attendance.id}
              formateurName={name}
              decided={review !== null}
            />
          )}
          {canExcuse(row.state) && row.date <= today && (
            <ExcuseAction
              profileId={row.profileId}
              slotId={row.slotId}
              date={row.date}
              formateurName={name}
            />
          )}
          {attendance?.requiresDeparture &&
            !attendance.departedAt &&
            row.date <= today && (
              <DepartureAction
                attendanceId={attendance.id}
                formateurName={name}
              />
            )}
          {excuse && <CancelExcuseButton excuseId={excuse.id} />}
        </div>
      )}
    </Card>
  );
}
