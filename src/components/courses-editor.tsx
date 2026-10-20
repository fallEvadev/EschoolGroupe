"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyCourse,
  MAX_COURSES,
  MAX_HEADCOUNT,
  type Course,
} from "@/lib/reports";

/**
 * Liste des cours d'un rapport : heures, classe, thème et effectif de chacun,
 * avec « Ajouter un cours ». Partagée par le formulaire du formateur et la
 * correction de la Direction. `idPrefix` garde les identifiants uniques quand
 * plusieurs rapports sont affichés sur la même page.
 */
export function CoursesEditor({
  courses,
  onChange,
  disabled,
  idPrefix,
}: {
  courses: Course[];
  onChange: (courses: Course[]) => void;
  disabled: boolean;
  idPrefix: string;
}) {
  function update(index: number, patch: Partial<Course>) {
    onChange(courses.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function add() {
    // Le nouveau cours commence quand le précédent se termine.
    const last = courses[courses.length - 1];
    onChange([...courses, emptyCourse(last?.endsAt ?? "")]);
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Cours de la journée">
      <h2 className="text-base font-semibold">Cours de la journée</h2>
      {courses.map((course, index) => (
        <div
          key={index}
          className="border-input flex flex-col gap-4 rounded-lg border p-3 sm:p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Cours {index + 1}</p>
            {courses.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(courses.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden />
                Retirer ce cours
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id={`${idPrefix}-${index}-start`} label="Heure de début">
              <Input
                type="time"
                value={course.startsAt}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { startsAt: event.target.value })
                }
              />
            </Field>
            <Field id={`${idPrefix}-${index}-end`} label="Heure de fin">
              <Input
                type="time"
                value={course.endsAt}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { endsAt: event.target.value })
                }
              />
            </Field>
          </div>

          <Field id={`${idPrefix}-${index}-classes`} label="Classe enseignée">
            <Input
              value={course.classes}
              maxLength={100}
              placeholder="Ex. : CI B"
              disabled={disabled}
              onChange={(event) =>
                update(index, { classes: event.target.value })
              }
            />
          </Field>

          <Field id={`${idPrefix}-${index}-theme`} label="Thème du cours">
            <Textarea
              value={course.theme}
              maxLength={500}
              placeholder="Ex. : apprendre les composants de l'ordinateur"
              className="min-h-16"
              disabled={disabled}
              onChange={(event) => update(index, { theme: event.target.value })}
            />
          </Field>

          <Field
            id={`${idPrefix}-${index}-headcount`}
            label="Effectif des élèves présents"
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_HEADCOUNT}
              value={course.headcount ?? ""}
              placeholder="Ex. : 28"
              disabled={disabled}
              onChange={(event) => {
                const raw = event.target.value;
                update(index, {
                  headcount: raw === "" ? null : Math.trunc(Number(raw)),
                });
              }}
            />
          </Field>
        </div>
      ))}

      {courses.length < MAX_COURSES && (
        <div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={disabled}
            onClick={add}
          >
            <Plus aria-hidden />
            Ajouter un cours
          </Button>
        </div>
      )}
    </section>
  );
}
