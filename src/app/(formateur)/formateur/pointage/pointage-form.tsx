"use client";

import { CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ATTENDANCE_BADGE, ATTENDANCE_LABELS } from "@/lib/attendance";
import { CODE_LENGTH, isCodeFormat } from "@/lib/daily-codes";
import { formatClock } from "@/lib/dates";
import { getDevicePosition } from "@/lib/geolocation";
import type { AttendanceResult } from "@/lib/validations/attendance";

import { submitAttendance } from "./actions";

type Confirmed = Extract<AttendanceResult, { ok: true }>;

/**
 * Saisie du code du jour et envoi du pointage avec la position du téléphone.
 * Le nom du formateur est affiché d'abord (identité confirmée), puis sur
 * l'écran de confirmation.
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
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"idle" | "locating" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  const busy = phase !== "idle";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isCodeFormat(code)) {
      setError(`Le code a ${CODE_LENGTH} chiffres.`);
      return;
    }
    setError(null);

    // 1. Position du téléphone (jamais bloquante : au pire « à vérifier »).
    setPhase("locating");
    const position = await getDevicePosition();

    // 2. Le serveur vérifie le code, l'heure et la position.
    setPhase("sending");
    const response = await submitAttendance({ slotId, code, position });
    setPhase("idle");

    if (response.ok) {
      setConfirmed(response);
      router.refresh();
    } else {
      setError(response.message);
    }
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
            <p className="text-xl font-bold">Présence enregistrée</p>
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
        <div>
          <Button asChild>
            <Link href="/formateur">Retour à l&apos;accueil</Link>
          </Button>
        </div>
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Code du jour</Label>
          <Input
            id="code"
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="000000"
            disabled={busy}
            aria-invalid={!!error}
            aria-describedby="code-help"
            // Chiffres seulement, au fil de la saisie.
            onChange={(event) =>
              setCode(
                event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH),
              )
            }
            className="h-14 text-center text-3xl font-bold tracking-[0.3em] tabular-nums"
          />
          <p id="code-help" className="text-muted-foreground text-sm">
            Le directeur de l&apos;école vous donne ce code. Autorisez la
            localisation quand le téléphone le demande : sans elle, votre
            présence sera à vérifier.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={busy || code.length !== CODE_LENGTH}
        >
          {phase === "locating"
            ? "Localisation en cours…"
            : phase === "sending"
              ? "Vérification…"
              : "Valider ma présence"}
        </Button>
      </form>
    </Card>
  );
}
