"use client";

import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { CoursesEditor } from "@/components/courses-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form";
import { EQUIPMENT_TYPES, equipmentTypeOf } from "@/lib/equipment-types";
import {
  shouldOfferDraft,
  shouldSaveDraft,
  type ReportDraft,
} from "@/lib/offline/report-drafts";
import {
  deleteLocalDraft,
  loadLocalDraft,
  purgeLocalDrafts,
  saveLocalDraft,
} from "@/lib/offline/report-drafts-store";
import {
  emptyIssue,
  MAX_ISSUES,
  missingForSubmit,
  type ReportContent,
} from "@/lib/reports";

import { saveReport } from "./actions";

/** Valeur du bouton « Autre » (matériel non listé, nom saisi à la main). */
const OTHER = "__autre__";

/** Pause après la dernière frappe avant d'écrire la copie locale. */
const AUTOSAVE_DELAY_MS = 800;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** État de la connexion du navigateur (toujours « en ligne » côté serveur). */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Formulaire du rapport journalier : les cours de la journée (heures, classe,
 * thème, effectif), puis les difficultés rencontrées (pannes), regroupées à la
 * fin et non déclarées cours par cours. « Enregistrer » garde un brouillon, « Envoyer » le passe à
 * la Direction. Le serveur revérifie tout.
 *
 * Hors ligne : la saisie est copiée en continu dans le navigateur (Dexie). Elle
 * n'est jamais envoyée toute seule : au retour du réseau, le formateur relit
 * puis envoie lui-même.
 */
export function ReportForm({
  attendanceId,
  initial,
}: {
  attendanceId: string;
  initial: ReportContent;
}) {
  const router = useRouter();
  const { userId } = useAuth();
  const online = useOnline();
  const [content, setContent] = useState<ReportContent>(initial);
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Brouillon local proposé au formateur, en attente de sa décision. */
  const [offered, setOffered] = useState<ReportDraft | null>(null);
  /** Copie locale active (après la décision sur le brouillon proposé). */
  const [autosave, setAutosave] = useState(false);
  /** La saisie n'a pas pu partir : elle n'existe que sur ce téléphone. */
  const [unsent, setUnsent] = useState(false);
  const wasOffline = useRef(false);
  /** Lignes de panne où le formateur a choisi « Autre équipement ». */
  const [otherRows, setOtherRows] = useState<Set<number>>(new Set());

  // Au chargement : nettoyage, puis proposition du brouillon local s'il y en a un.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      await purgeLocalDrafts(userId);
      const draft = await loadLocalDraft(attendanceId);
      if (cancelled) return;
      if (shouldOfferDraft(draft, userId, initial, Date.now())) {
        setOffered(draft);
      } else {
        setAutosave(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, attendanceId, initial]);

  // Copie locale après une courte pause ; supprimée si la saisie redevient
  // identique à la version du serveur (rien à protéger).
  useEffect(() => {
    if (!autosave || !userId || pending !== null) return;
    if (!shouldSaveDraft(content, initial)) {
      void deleteLocalDraft(attendanceId);
      return;
    }
    const timer = setTimeout(
      () => void saveLocalDraft(attendanceId, userId, content),
      AUTOSAVE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [autosave, userId, pending, content, initial, attendanceId]);

  // Retour du réseau : on prévient, on n'envoie rien.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.info(
        unsent
          ? "Connexion rétablie. Relisez votre rapport puis envoyez-le."
          : "Connexion rétablie.",
      );
    }
  }, [online, unsent]);

  function resumeLocalDraft() {
    if (!offered) return;
    setContent(offered.content);
    setOffered(null);
    setAutosave(true);
  }

  function discardLocalDraft() {
    void deleteLocalDraft(attendanceId);
    setOffered(null);
    setAutosave(true);
  }

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
          : [emptyIssue()],
    });
  }

  /** « Autre » : choisi à la main, ou nom enregistré qui n'est pas un type proposé. */
  function isOtherRow(index: number): boolean {
    const equipment = content.issues[index]?.equipment ?? "";
    return (
      otherRows.has(index) || (equipment !== "" && !equipmentTypeOf(equipment))
    );
  }

  function chooseEquipment(index: number, value: string) {
    const rows = new Set(otherRows);
    if (value === OTHER) {
      rows.add(index);
      // On repart d'un nom vide, sauf si le nom saisi est déjà un nom libre.
      const current = content.issues[index]?.equipment ?? "";
      updateIssue(index, {
        machineId: null,
        equipment: equipmentTypeOf(current) ? "" : current,
      });
    } else {
      rows.delete(index);
      updateIssue(index, { machineId: null, equipment: value });
    }
    setOtherRows(rows);
  }

  function removeIssue(index: number) {
    const issues = content.issues.filter((_, i) => i !== index);
    // Les numéros de ligne suivants reculent d'un cran.
    setOtherRows(
      new Set(
        [...otherRows]
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i)),
      ),
    );
    // Plus aucune panne : le matériel est de nouveau « OK ».
    update({ issues, equipmentOk: issues.length === 0 });
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

    const keepLocal = async (message: string) => {
      if (userId) await saveLocalDraft(attendanceId, userId, content);
      setUnsent(true);
      setError(message);
    };

    if (!online) {
      await keepLocal(
        "Pas de connexion. Votre saisie est gardée sur ce téléphone : envoyez-la quand le réseau revient.",
      );
      return;
    }

    setPending(submit ? "submit" : "draft");
    let response: Awaited<ReturnType<typeof saveReport>>;
    try {
      response = await saveReport({ attendanceId, ...content, submit });
    } catch {
      // Réseau coupé en cours d'envoi : rien n'est perdu, la copie locale reste.
      setPending(null);
      await keepLocal(
        "La connexion a échoué. Votre saisie est gardée sur ce téléphone : réessayez quand le réseau revient.",
      );
      return;
    }
    setPending(null);

    if (!response.ok) {
      setError(response.message);
      return;
    }
    // Le serveur a la version à jour : la copie locale n'a plus de raison d'être.
    await deleteLocalDraft(attendanceId);
    setUnsent(false);
    toast.success(response.message);
    if (response.submitted) {
      router.push("/formateur/cahiers");
    }
    router.refresh();
  }

  // Le formulaire reste figé tant que le formateur n'a pas choisi quoi faire
  // du brouillon local proposé.
  const busy = pending !== null || offered !== null;

  return (
    <Card className="p-4 sm:p-6">
      {offered && (
        <div
          role="status"
          className="bg-warning-soft text-warning mb-4 flex flex-col gap-3 rounded-lg p-3 text-sm"
        >
          <p>
            <span className="font-semibold">
              Un brouillon non envoyé a été retrouvé sur ce téléphone.
            </span>{" "}
            Voulez-vous le reprendre ?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="sm" onClick={resumeLocalDraft}>
              Reprendre mon brouillon
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={discardLocalDraft}
            >
              Ignorer
            </Button>
          </div>
        </div>
      )}

      {!online && (
        <p
          role="status"
          className="bg-warning-soft text-warning mb-4 flex items-center gap-2 rounded-lg p-3 text-sm"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Hors ligne : votre saisie est gardée sur ce téléphone.
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(true);
        }}
        className="flex flex-col gap-6"
        noValidate
      >
        <CoursesEditor
          courses={content.courses}
          onChange={(courses) => update({ courses })}
          disabled={busy}
          idPrefix="course"
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="text-base font-semibold">
            Difficultés rencontrées
          </legend>
          <p className="text-muted-foreground text-sm">
            Pour toute la journée : signalez ici les pannes, sans les répéter
            cours par cours.
          </p>
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
              Signaler une difficulté
            </Button>
          </div>

          {!content.equipmentOk && (
            <div className="flex flex-col gap-3">
              {content.issues.map((issue, index) => (
                <div
                  key={index}
                  className="border-input flex flex-col gap-2 rounded-lg border p-3"
                >
                  <span
                    id={`equipment-${index}`}
                    className="text-sm leading-none font-medium"
                  >
                    Qu&apos;est-ce qui est en panne ?
                  </span>
                  <div
                    role="group"
                    aria-labelledby={`equipment-${index}`}
                    className="flex flex-wrap gap-2"
                  >
                    {[...EQUIPMENT_TYPES, OTHER].map((choice) => {
                      const selected =
                        choice === OTHER
                          ? isOtherRow(index)
                          : issue.equipment === choice;
                      return (
                        <Button
                          key={choice}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() => chooseEquipment(index, choice)}
                        >
                          {choice === OTHER ? "Autre" : choice}
                        </Button>
                      );
                    })}
                  </div>
                  {isOtherRow(index) && (
                    <Input
                      aria-label="Nom du matériel en panne"
                      value={issue.equipment}
                      maxLength={80}
                      placeholder="Ex. : prise de la salle 2"
                      disabled={busy}
                      onChange={(event) =>
                        updateIssue(index, { equipment: event.target.value })
                      }
                    />
                  )}
                  <Label htmlFor={`issue-${index}`}>Description</Label>
                  <Textarea
                    id={`issue-${index}`}
                    value={issue.description}
                    maxLength={300}
                    placeholder="Combien et ce qui ne marche pas (ex. : 3 souris, deux ne s'allument plus)"
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
                      className="w-full sm:w-auto"
                      disabled={busy}
                      onClick={() => removeIssue(index)}
                    >
                      <Trash2 aria-hidden />
                      Retirer cette difficulté
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
                    className="w-full sm:w-auto"
                    disabled={busy}
                    onClick={() =>
                      update({ issues: [...content.issues, emptyIssue()] })
                    }
                  >
                    <Plus aria-hidden />
                    Ajouter une autre difficulté
                  </Button>
                </div>
              )}
            </div>
          )}
        </fieldset>

        <FormError>{error}</FormError>

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
