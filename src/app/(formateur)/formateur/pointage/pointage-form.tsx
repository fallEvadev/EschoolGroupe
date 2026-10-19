"use client";

import { CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ATTENDANCE_BADGE,
  ATTENDANCE_LABELS,
  locationProblemMessage,
  type DevicePosition,
} from "@/lib/attendance";
import { formatClock } from "@/lib/dates";
import { getDevicePosition } from "@/lib/geolocation";
import type { AttendanceResult } from "@/lib/validations/attendance";

import { submitAttendance } from "./actions";

type Confirmed = Extract<AttendanceResult, { ok: true }>;

/**
 * Pointage d'arrivée : un seul bouton, qui relève la position du téléphone au
 * moment du clic. Pas de code à l'arrivée (le code du directeur valide la
 * descente). Le nom du formateur est affiché d'abord (identité confirmée), puis
 * sur l'écran de confirmation.
 */
export function PointageForm({
  slotId,
  fullName,
  schoolName,
  timeLabel,
}: {
  slotId: string;
  fullName: string;
  schoolName: string;
  /** Horaires du créneau déjà formatés, ex. « 08:00–10:00 ». */
  timeLabel: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "locating" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  // Le téléphone n'a pas donné sa position : on explique, et le formateur choisit.
  const [problem, setProblem] = useState<{
    position: Exclude<DevicePosition, { status: "ok" }>;
    message: string;
  } | null>(null);

  const busy = phase !== "idle";

  /** Envoie le pointage au serveur, qui vérifie l'heure et la position. */
  async function send(position: DevicePosition) {
    setPhase("sending");
    const response = await submitAttendance({ slotId, position });
    setPhase("idle");

    if (response.ok) {
      setConfirmed(response);
      router.refresh();
    } else {
      setError(response.message);
    }
  }

  /** Relève la position du téléphone au moment du clic, puis envoie. */
  async function locateAndSend() {
    setError(null);
    setProblem(null);
    setPhase("locating");
    const position = await getDevicePosition();
    if (position.status !== "ok") {
      // Refus ou GPS en erreur : message clair, et le choix de réessayer ou de
      // pointer quand même (la présence sera alors « à vérifier »).
      setPhase("idle");
      setProblem({
        position,
        message: locationProblemMessage(position.status),
      });
      return;
    }
    await send(position);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void locateAndSend();
  }

  if (confirmed) {
    const Icon =
      confirmed.status === "present"
        ? CheckCircle2
        : confirmed.status === "retard"
          ? Clock
          : TriangleAlert;
    return (
      <Card className="flex flex-col gap-4 p-4 sm:p-6" role="status">
        <div className="flex items-start gap-3">
          <Icon
            className={
              confirmed.status === "present"
                ? "text-success size-8 shrink-0"
                : confirmed.status === "retard"
                  ? "text-warning size-8 shrink-0"
                  : "text-destructive size-8 shrink-0"
            }
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p className="text-xl font-bold">
              Pointage enregistré avec succès.
            </p>
            <p className="font-medium">{confirmed.fullName}</p>
            <p className="text-muted-foreground text-sm">
              {confirmed.schoolName} · {timeLabel} · pointé à{" "}
              {formatClock(confirmed.recordedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ATTENDANCE_BADGE[confirmed.status]}>
            {ATTENDANCE_LABELS[confirmed.status]}
          </Badge>
          {confirmed.lateMinutes > 0 && (
            <span className="text-muted-foreground text-sm">
              {confirmed.lateMinutes} min après le début
            </span>
          )}
        </div>
        {confirmed.explanation && (
          <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
            {confirmed.explanation}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          À la fin du cours, le directeur vous donnera un code pour valider
          votre descente. Votre rapport s&apos;ouvre 10 minutes avant la fin.
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/formateur">Retour à l&apos;accueil</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">
            Vous pointez en tant que
          </p>
          <p className="text-2xl font-bold">{fullName}</p>
          <p className="text-muted-foreground text-sm">
            {schoolName} · {timeLabel}
          </p>
        </div>

        <p className="text-muted-foreground text-sm">
          Touchez le bouton en arrivant à l&apos;école et autorisez la
          localisation quand le téléphone le demande.
        </p>

        {error && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        )}

        {problem && (
          <div
            role="alert"
            className="bg-warning-soft text-warning flex flex-col gap-3 rounded-lg p-3 text-sm"
          >
            <p>{problem.message}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void locateAndSend()}
              >
                Réessayer la localisation
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const position = problem.position;
                  setProblem(null);
                  void send(position);
                }}
              >
                Pointer quand même (position non confirmée)
              </Button>
            </div>
          </div>
        )}

        <Button type="submit" size="lg" disabled={busy}>
          {phase === "locating"
            ? "Localisation en cours…"
            : phase === "sending"
              ? "Vérification…"
              : "📍 Je suis arrivé à l'école"}
        </Button>
      </form>
    </Card>
  );
}
