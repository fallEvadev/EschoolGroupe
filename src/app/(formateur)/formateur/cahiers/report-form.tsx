"use client";

import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  MAX_ISSUES,
  missingForSubmit,
  type ReportContent,
} from "@/lib/reports";

import { saveReport } from "./actions";

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
 * Formulaire du rapport journalier : classes, thème du cours, état du matériel
 * (avec les pannes). « Enregistrer » garde un brouillon, « Envoyer » le passe à
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
