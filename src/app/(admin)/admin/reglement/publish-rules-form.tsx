"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  publishRulesSchema,
  type PublishRulesInput,
} from "@/lib/validations/rules";

import { publishRules } from "./actions";

/** Message d'erreur sous un champ. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="rules-title">Titre</Label>
        <Input
          id="rules-title"
          placeholder="Règlement intérieur du personnel"
          disabled={isSubmitting}
          aria-invalid={!!errors.title}
          aria-describedby="rules-title-error"
          {...register("title")}
        />
        <FieldError id="rules-title-error" message={errors.title?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rules-content">Texte du règlement</Label>
        <Textarea
          id="rules-content"
          rows={14}
          disabled={isSubmitting}
          aria-invalid={!!errors.content}
          aria-describedby="rules-content-error"
          {...register("content")}
        />
        <FieldError
          id="rules-content-error"
          message={errors.content?.message}
        />
        <p className="text-muted-foreground text-xs">
          Texte brut : les retours à la ligne sont conservés. Une version
          publiée ne peut plus être modifiée.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Publication…" : "Publier cette version"}
        </Button>
      </div>
    </form>
  );
}
