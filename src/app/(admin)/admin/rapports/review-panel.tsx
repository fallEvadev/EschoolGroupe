"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ISSUES, type ReportContent } from "@/lib/reports";
import type { ReviewDecision } from "@/lib/validations/reports";

import { reviewReport } from "./actions";

type Mode = "idle" | "correct" | "modify";

/**
 * Décision de la Direction sur un rapport envoyé : valider, valider en
 * corrigeant, ou demander une modification (commentaire obligatoire).
 */
export function ReviewPanel({
  reportId,
  content,
}: {
  reportId: string;
  content: ReportContent;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState<ReportContent>(content);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: ReviewDecision) {
    setError(null);
    setBusy(true);
    const response = await reviewReport({
      reportId,
      decision,
      comment,
      corrections: decision === "valide_avec_corrections" ? draft : undefined,
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    toast.success(response.message);
    router.refresh();
  }

  function updateIssue(
    index: number,
    patch: Partial<ReportContent["issues"][number]>,
  ) {
    setDraft((d) => ({
      ...d,
      issues: d.issues.map((issue, i) =>
        i === index ? { ...issue, ...patch } : issue,
      ),
    }));
  }

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      {mode === "correct" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`classes-${reportId}`}>Classe(s)</Label>
            <Input
              id={`classes-${reportId}`}
              value={draft.classes}
              maxLength={300}
              disabled={busy}
              onChange={(e) => setDraft({ ...draft, classes: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`theme-${reportId}`}>Thème du cours</Label>
            <Textarea
              id={`theme-${reportId}`}
              value={draft.courseTheme}
              maxLength={1000}
              disabled={busy}
              onChange={(e) =>
                setDraft({ ...draft, courseTheme: e.target.value })
              }
            />
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">Matériel</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="sm"
                variant={draft.equipmentOk ? "default" : "outline"}
                aria-pressed={draft.equipmentOk}
                disabled={busy}
                onClick={() =>
                  setDraft({ ...draft, equipmentOk: true, issues: [] })
                }
              >
                Tout fonctionne
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.equipmentOk ? "outline" : "default"}
                aria-pressed={!draft.equipmentOk}
                disabled={busy}
                onClick={() =>
                  setDraft({
                    ...draft,
                    equipmentOk: false,
                    issues:
                      draft.issues.length > 0
                        ? draft.issues
                        : [{ equipment: "", description: "" }],
                  })
                }
              >
                Pannes signalées
              </Button>
            </div>
            {!draft.equipmentOk &&
              draft.issues.map((issue, index) => (
                <div
                  key={index}
                  className="border-input flex flex-col gap-2 rounded-lg border p-3"
                >
                  <Input
                    aria-label="Équipement en panne"
                    value={issue.equipment}
                    maxLength={80}
                    placeholder="Équipement"
                    disabled={busy}
                    onChange={(e) =>
                      updateIssue(index, { equipment: e.target.value })
                    }
                  />
                  <Textarea
                    aria-label="Description de la panne"
                    value={issue.description}
                    maxLength={300}
                    placeholder="Description"
                    className="min-h-16"
                    disabled={busy}
                    onChange={(e) =>
                      updateIssue(index, { description: e.target.value })
                    }
                  />
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        const issues = draft.issues.filter(
                          (_, i) => i !== index,
                        );
                        setDraft({
                          ...draft,
                          issues,
                          equipmentOk: issues.length === 0,
                        });
                      }}
                    >
                      <Trash2 aria-hidden />
                      Retirer
                    </Button>
                  </div>
                </div>
              ))}
            {!draft.equipmentOk && draft.issues.length < MAX_ISSUES && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      issues: [
                        ...draft.issues,
                        { equipment: "", description: "" },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden />
                  Ajouter une panne
                </Button>
              </div>
            )}
          </fieldset>
        </div>
      )}

      {mode !== "idle" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`comment-${reportId}`}>
            {mode === "modify"
              ? "Ce que le formateur doit modifier"
              : "Commentaire (facultatif)"}
          </Label>
          <Textarea
            id={`comment-${reportId}`}
            value={comment}
            maxLength={500}
            className="min-h-20"
            disabled={busy}
            aria-invalid={!!error}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mode === "idle" ? (
          <>
            <Button disabled={busy} onClick={() => void decide("valide")}>
              Valider
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraft(content);
                setMode("correct");
              }}
            >
              Corriger et valider
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setMode("modify")}
            >
              Demander une modification
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={busy}
              onClick={() =>
                void decide(
                  mode === "correct" ? "valide_avec_corrections" : "a_modifier",
                )
              }
            >
              {busy
                ? "Enregistrement…"
                : mode === "correct"
                  ? "Valider avec ces corrections"
                  : "Renvoyer au formateur"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
            >
              Annuler
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
