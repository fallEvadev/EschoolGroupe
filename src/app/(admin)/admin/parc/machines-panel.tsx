"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SELECT_CLASS } from "@/components/ui/select";
import { Field, FormError } from "@/components/ui/form";
import {
  MACHINE_KIND_LABELS,
  MACHINE_KINDS,
  machineKindLabel,
  type MachineKind,
} from "@/lib/machines";
import {
  machineSchema,
  machineUpdateSchema,
  type MachineResult,
} from "@/lib/validations/machines";

import { addMachine, setMachineStatus, updateMachine } from "./actions";

export type MachineView = {
  id: string;
  label: string;
  kind: string;
  serialNumber: string | null;
  archived: boolean;
};

function notify(result: MachineResult) {
  if (result.ok) toast.success(result.message);
  else toast.error(result.message);
}

/**
 * Machines d'une école : la liste, puis une ligne d'ajout toujours visible (nom,
 * type, « Ajouter »). Le numéro de série est facultatif et ne se saisit qu'en
 * modifiant une machine : beaucoup de machines n'en ont pas.
 */
export function MachinesPanel({
  schoolId,
  machines,
  schoolArchived,
}: {
  schoolId: string;
  machines: MachineView[];
  /** École archivée : l'inventaire reste consultable, sans ajout. */
  schoolArchived: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {machines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune machine enregistrée. Ce n&apos;est pas obligatoire : sans liste,
          le formateur écrit lui-même le nom du matériel en panne.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-xl border">
          {machines.map((machine) => (
            <MachineRow key={machine.id} machine={machine} />
          ))}
        </ul>
      )}

      {!schoolArchived && <QuickAddMachine schoolId={schoolId} />}
    </div>
  );
}

function MachineRow({ machine }: { machine: MachineView }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleStatus() {
    startTransition(async () => {
      notify(
        await setMachineStatus({
          machineId: machine.id,
          status: machine.archived ? "actif" : "archive",
        }),
      );
    });
  }

  if (editing) {
    return (
      <li className="p-3 sm:p-4">
        <MachineFields
          idPrefix={machine.id}
          initial={{
            label: machine.label,
            kind: machine.kind,
            serialNumber: machine.serialNumber ?? "",
          }}
          submitLabel="Enregistrer"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            const parsed = machineUpdateSchema.safeParse({
              machineId: machine.id,
              ...values,
            });
            if (!parsed.success) {
              return {
                ok: false,
                message:
                  parsed.error.issues[0]?.message ?? "Données invalides.",
              };
            }
            const result = await updateMachine(parsed.data);
            if (result.ok) setEditing(false);
            return result;
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{machine.label}</p>
        <p className="text-muted-foreground text-sm break-words">
          {machineKindLabel(machine.kind)}
          {machine.serialNumber && ` · N° ${machine.serialNumber}`}
        </p>
      </div>
      {machine.archived && <Badge variant="neutral">Archivée</Badge>}
      <div className="flex gap-2">
        {!machine.archived && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
            Modifier
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={toggleStatus}
        >
          {machine.archived ? "Restaurer" : "Archiver"}
        </Button>
      </div>
    </li>
  );
}

/** Ajout en une ligne : on écrit le nom, on choisit le type, on appuie sur « Ajouter ». */
function QuickAddMachine({ schoolId }: { schoolId: string }) {
  return (
    <MachineFields
      idPrefix={`new-${schoolId}`}
      compact
      initial={{ label: "", kind: "ordinateur", serialNumber: "" }}
      submitLabel="Ajouter"
      clearOnSuccess
      onSubmit={async (values) => {
        const parsed = machineSchema.safeParse({ schoolId, ...values });
        if (!parsed.success) {
          return {
            ok: false,
            message: parsed.error.issues[0]?.message ?? "Données invalides.",
          };
        }
        return addMachine(parsed.data);
      }}
    />
  );
}

type FieldValues = { label: string; kind: string; serialNumber: string };

/**
 * Champs communs à l'ajout (version compacte, sans numéro de série) et à la
 * modification. Le serveur revérifie tout.
 */
function MachineFields({
  idPrefix,
  initial,
  submitLabel,
  compact,
  clearOnSuccess,
  onSubmit,
  onCancel,
}: {
  /** Garde les identifiants uniques quand plusieurs formulaires sont affichés. */
  idPrefix: string;
  initial: FieldValues;
  submitLabel: string;
  compact?: boolean;
  clearOnSuccess?: boolean;
  onSubmit: (values: FieldValues) => Promise<MachineResult>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<FieldValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      if (clearOnSuccess) setValues(initial);
    });
  }

  const id = (name: string) => `machine-${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div
        className={
          compact
            ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end"
            : "grid gap-3 sm:grid-cols-3"
        }
      >
        <Field id={id("label")} label={compact ? "Nouvelle machine" : "Nom"}>
          <Input
            id={id("label")}
            value={values.label}
            maxLength={60}
            placeholder="Ex. : Salle 1 – Poste 3"
            disabled={pending}
            onChange={(event) =>
              setValues({ ...values, label: event.target.value })
            }
          />
        </Field>
        <Field id={id("kind")} label="Type">
          <select
            id={id("kind")}
            className={SELECT_CLASS}
            value={values.kind}
            disabled={pending}
            onChange={(event) =>
              setValues({ ...values, kind: event.target.value })
            }
          >
            {MACHINE_KINDS.map((kind: MachineKind) => (
              <option key={kind} value={kind}>
                {MACHINE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
        {compact ? (
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            <Plus aria-hidden />
            {pending ? "Ajout…" : submitLabel}
          </Button>
        ) : (
          <Field id={id("serial")} label="N° de série (facultatif)">
            <Input
              id={id("serial")}
              value={values.serialNumber}
              maxLength={80}
              disabled={pending}
              onChange={(event) =>
                setValues({ ...values, serialNumber: event.target.value })
              }
            />
          </Field>
        )}
      </div>

      <FormError>{error}</FormError>

      {!compact && (
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : submitLabel}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Annuler
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
