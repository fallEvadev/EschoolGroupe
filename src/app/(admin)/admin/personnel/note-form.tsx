"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { staffNoteSchema, type StaffResult } from "@/lib/validations/staff";

import { saveStaffNote } from "./actions";

const noteSchema = staffNoteSchema.pick({ content: true });
type NoteValues = { content: string };

/** Note de suivi d'une fiche (visible par la direction uniquement). */
export function NoteForm({
  profileId,
  initial,
}: {
  profileId: string;
  initial: string;
}) {
  const [result, setResult] = useState<StaffResult | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { content: initial },
  });

  async function onSubmit(values: NoteValues) {
    const response = await saveStaffNote({ profileId, ...values });
    setResult(response);
    if (response.ok) reset(values);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setResult(null)}
      className="flex flex-col gap-3"
      noValidate
    >
      <Label htmlFor="content">
        Note de suivi{" "}
        <span className="text-muted-foreground font-normal">
          (visible par la direction uniquement)
        </span>
      </Label>
      <textarea
        id="content"
        rows={4}
        placeholder="Entretien, évaluation pédagogique, besoins en formation…"
        disabled={isSubmitting}
        aria-invalid={!!errors.content}
        className="border-input bg-card placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:text-sm"
        {...register("content")}
      />
      {errors.content && (
        <p className="text-destructive text-sm">{errors.content.message}</p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p
          role="status"
          aria-live="polite"
          className={
            result?.ok ? "text-success text-sm" : "text-destructive text-sm"
          }
        >
          {result?.message}
        </p>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Enregistrement…" : "Enregistrer la note"}
        </Button>
      </div>
    </form>
  );
}
