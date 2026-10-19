"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormActions } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  publishRulesSchema,
  type PublishRulesInput,
} from "@/lib/validations/rules";

import { publishRules } from "./actions";

/** Publication d'une nouvelle version (pré-remplie avec la version en vigueur). */
export function PublishRulesForm({ initial }: { initial: PublishRulesInput }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PublishRulesInput>({
    // Même schéma Zod que le serveur, qui revérifie tout.
    resolver: zodResolver(publishRulesSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: PublishRulesInput) {
    const result = await publishRules(values);
    if (result.ok) {
      toast.success(result.message);
      // La page se recharge avec la nouvelle version comme point de départ.
      reset(values);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field id="rules-title" label="Titre" error={errors.title?.message}>
        <Input
          placeholder="Règlement intérieur du personnel"
          disabled={isSubmitting}
          {...register("title")}
        />
      </Field>

      <Field
        id="rules-content"
        label="Texte du règlement"
        error={errors.content?.message}
        hint="Texte brut : les retours à la ligne sont conservés. Une version publiée ne peut plus être modifiée."
      >
        <Textarea rows={14} disabled={isSubmitting} {...register("content")} />
      </Field>

      <FormActions>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Publication…" : "Publier cette version"}
        </Button>
      </FormActions>
    </form>
  );
}
