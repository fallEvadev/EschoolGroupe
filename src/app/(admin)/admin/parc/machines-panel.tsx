"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const SELECT_CLASS =
  "border-input bg-card focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:text-sm";

function notify(result: MachineResult) {
  if (result.ok) toast.success(result.message);
  else toast.error(result.message);
}

/** Inventaire d'une école : liste, ajout, modification, archivage. */
export function MachinesPanel({
  schoolId,
  schoolName,
  machines,
  schoolArchived,
}: {
  schoolId: string;
  schoolName: string;
  machines: MachineView[];
  /** École archivée : l'inventaire reste consultable, sans ajout. */
  schoolArchived: boolean;
}) {
  const active = machines.filter((m) => !m.archived).length;

  return (
    <Card className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold break-words">{schoolName}</h2>
        <p className="text-muted-foreground text-sm">
          {active} machine{active > 1 ? "s" : ""} active{active > 1 ? "s" : ""}
          {machines.length > active &&
            ` · ${machines.length - active} archivée(s)`}
        </p>
      </div>

      {machines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune machine pour cette école. Ajoutez la première ci-dessous : les
          formateurs la choisiront dans leur rapport pour signaler une panne.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-xl border">
          {machines.map((machine) => (
            <MachineRow key={machine.id} machine={machine} />
          ))}
        </ul>
      )}

      {!schoolArchived && <AddMachineForm schoolId={schoolId} />}
    </Card>
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

function AddMachineForm({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          Ajouter une machine
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3 sm:p-4">
      <h3 className="font-semibold">Nouvelle machine</h3>
      <MachineFields
        initial={{ label: "", kind: "ordinateur", serialNumber: "" }}
        submitLabel="Ajouter"
        clearOnSuccess
        onCancel={() => setOpen(false)}
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
    </div>
  );
}

type FieldValues = { label: string; kind: string; serialNumber: string };

/** Champs communs à l'ajout et à la modification. Le serveur revérifie tout. */
function MachineFields({
  initial,
  submitLabel,
  clearOnSuccess,
  onSubmit,
  onCancel,
}: {
  initial: FieldValues;
  submitLabel: string;
  clearOnSuccess?: boolean;
  onSubmit: (values: FieldValues) => Promise<MachineResult>;
  onCancel: () => void;
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

  const id = (name: string) => `machine-${initial.label || "new"}-${name}`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("label")}>Nom</Label>
          <Input
            id={id("label")}
            value={values.label}
            maxLength={60}
            placeholder="Ex. : PC 4"
            disabled={pending}
            onChange={(event) =>
              setValues({ ...values, label: event.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("kind")}>Type</Label>
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
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("serial")}>N° de série (facultatif)</Label>
          <Input
            id={id("serial")}
            value={values.serialNumber}
            maxLength={80}
            disabled={pending}
            onChange={(event) =>
              setValues({ ...values, serialNumber: event.target.value })
            }
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
