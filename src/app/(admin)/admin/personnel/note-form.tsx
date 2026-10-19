"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormActions } from "@/components/ui/form";
import { staffNoteSchema } from "@/lib/validations/staff";

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
    if (response.ok) toast.success(response.message);
    else toast.error(response.message);
    if (response.ok) reset(values);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3"
      noValidate
    >
      <Field
        id="content"
        label={
          <>
            Note de suivi{" "}
            <span className="text-muted-foreground font-normal">
              (visible par la direction uniquement)
            </span>
          </>
        }
        error={errors.content?.message}
      >
        <Textarea
          rows={4}
          placeholder="Entretien, évaluation pédagogique, besoins en formation…"
          disabled={isSubmitting}
          {...register("content")}
        />
      </Field>
      <FormActions className="sm:justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Enregistrement…" : "Enregistrer la note"}
        </Button>
      </FormActions>
    </form>
  );
}
