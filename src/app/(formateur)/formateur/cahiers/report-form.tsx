"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_ISSUES,
  missingForSubmit,
  type ReportContent,
} from "@/lib/reports";

import { saveReport } from "./actions";

/**
 * Formulaire du rapport journalier : classes, thème du cours, état du matériel
 * (avec les pannes). « Enregistrer » garde un brouillon, « Envoyer » le passe à
 * la Direction. Le serveur revérifie tout.
 */
export function ReportForm({
  attendanceId,
  initial,
}: {
  attendanceId: string;
  initial: ReportContent;
}) {
  const router = useRouter();
  const [content, setContent] = useState<ReportContent>(initial);
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<ReportContent>) {
    setContent((current) => ({ ...current, ...patch }));
  }

  function setEquipmentOk(equipmentOk: boolean) {
    update({
      equipmentOk,
      // « En panne » démarre avec une ligne vide à remplir ; « tout va bien »
      // efface les pannes (la base refuse les deux à la fois).
      issues: equipmentOk
        ? []
        : content.issues.length > 0
          ? content.issues
          : [{ equipment: "", description: "" }],
    });
  }

  function updateIssue(
    index: number,
    patch: Partial<ReportContent["issues"][number]>,
  ) {
    update({
      issues: content.issues.map((issue, i) =>
        i === index ? { ...issue, ...patch } : issue,
      ),
    });
  }

  async function send(submit: boolean) {
    setError(null);
    if (submit) {
      const missing = missingForSubmit(content);
      if (missing) {
        setError(missing);
        return;
      }
    }
    setPending(submit ? "submit" : "draft");
    const response = await saveReport({ attendanceId, ...content, submit });
    setPending(null);

    if (!response.ok) {
      setError(response.message);
      return;
    }
    toast.success(response.message);
    if (response.submitted) {
      router.push("/formateur/cahiers");
    }
    router.refresh();
  }

  const busy = pending !== null;

  return (
    <Card className="p-4 sm:p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(true);
        }}
        className="flex flex-col gap-6"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="classes">Classe(s)</Label>
          <Input
            id="classes"
            value={content.classes}
            maxLength={300}
            placeholder="Ex. : 3e A, 3e B"
            disabled={busy}
            onChange={(event) => update({ classes: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="theme">Thème du cours</Label>
          <Textarea
            id="theme"
            value={content.courseTheme}
            maxLength={1000}
            placeholder="Ce qui a été enseigné aujourd'hui"
            disabled={busy}
            onChange={(event) => update({ courseTheme: event.target.value })}
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">
            État du matériel informatique
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant={content.equipmentOk ? "default" : "outline"}
              aria-pressed={content.equipmentOk}
              disabled={busy}
              onClick={() => setEquipmentOk(true)}
            >
              Tout fonctionne
            </Button>
            <Button
              type="button"
              variant={content.equipmentOk ? "outline" : "default"}
              aria-pressed={!content.equipmentOk}
              disabled={busy}
              onClick={() => setEquipmentOk(false)}
            >
              Signaler une panne
            </Button>
          </div>

          {!content.equipmentOk && (
            <div className="flex flex-col gap-3">
              {content.issues.map((issue, index) => (
                <div
                  key={index}
                  className="border-input flex flex-col gap-2 rounded-lg border p-3"
                >
                  <Label htmlFor={`equipment-${index}`}>
                    Équipement en panne
                  </Label>
                  <Input
                    id={`equipment-${index}`}
                    value={issue.equipment}
                    maxLength={80}
                    placeholder="Ex. : PC 4, vidéoprojecteur"
                    disabled={busy}
                    onChange={(event) =>
                      updateIssue(index, { equipment: event.target.value })
                    }
                  />
                  <Label htmlFor={`issue-${index}`}>Description</Label>
                  <Textarea
                    id={`issue-${index}`}
                    value={issue.description}
                    maxLength={300}
                    placeholder="Ce qui ne marche pas"
                    className="min-h-16"
                    disabled={busy}
                    onChange={(event) =>
                      updateIssue(index, { description: event.target.value })
                    }
                  />
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        const issues = content.issues.filter(
                          (_, i) => i !== index,
                        );
                        // Plus aucune panne : le matériel est de nouveau « OK ».
                        update({ issues, equipmentOk: issues.length === 0 });
                      }}
                    >
                      <Trash2 aria-hidden />
                      Retirer cette panne
                    </Button>
                  </div>
                </div>
              ))}
              {content.issues.length < MAX_ISSUES && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      update({
                        issues: [
                          ...content.issues,
                          { equipment: "", description: "" },
                        ],
                      })
                    }
                  >
                    <Plus aria-hidden />
                    Ajouter une autre panne
                  </Button>
                </div>
              )}
            </div>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" size="lg" disabled={busy}>
            {pending === "submit" ? "Envoi…" : "Envoyer à la Direction"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => void send(false)}
          >
            {pending === "draft"
              ? "Enregistrement…"
              : "Enregistrer le brouillon"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
