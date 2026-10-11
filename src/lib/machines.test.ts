import { describe, expect, it } from "vitest";

import { isMachineKind, machineKindLabel, sortMachines } from "@/lib/machines";
import {
  machineSchema,
  machineStatusSchema,
  machineUpdateSchema,
} from "@/lib/validations/machines";

const SCHOOL_ID = "6f1c1a52-4b1e-4c0e-9d54-2a3b8d3c9e11";
const MACHINE_ID = "0b6f5d52-1d4c-4a45-8f1a-7c2e9a4d5b33";

describe("machineKindLabel", () => {
  it("donne le libellé français d'un type connu", () => {
    expect(machineKindLabel("videoprojecteur")).toBe("Vidéoprojecteur");
  });

  it("renvoie la valeur brute pour un type inconnu", () => {
    expect(machineKindLabel("scanner")).toBe("scanner");
    expect(isMachineKind("scanner")).toBe(false);
  });
});

describe("sortMachines", () => {
  it("met les actives d'abord et trie PC 2 avant PC 10", () => {
    const sorted = sortMachines([
      { label: "PC 10", status: "actif" },
      { label: "Ancien PC", status: "archive" },
      { label: "PC 2", status: "actif" },
    ]);
    expect(sorted.map((m) => m.label)).toEqual(["PC 2", "PC 10", "Ancien PC"]);
  });
});

describe("machineSchema", () => {
  const valid = {
    schoolId: SCHOOL_ID,
    label: "  PC 4 ",
    kind: "ordinateur",
    serialNumber: "",
  };

  it("nettoie le nom et transforme un numéro de série vide en null", () => {
    const parsed = machineSchema.parse(valid);
    expect(parsed.label).toBe("PC 4");
    expect(parsed.serialNumber).toBeNull();
  });

  it("garde un numéro de série renseigné", () => {
    expect(
      machineSchema.parse({ ...valid, serialNumber: " SN-123 " }).serialNumber,
    ).toBe("SN-123");
  });

  it("refuse un nom vide ou trop long", () => {
    expect(machineSchema.safeParse({ ...valid, label: "   " }).success).toBe(
      false,
    );
    expect(
      machineSchema.safeParse({ ...valid, label: "x".repeat(61) }).success,
    ).toBe(false);
  });

  it("refuse un type inconnu et une école invalide", () => {
    expect(machineSchema.safeParse({ ...valid, kind: "scanner" }).success).toBe(
      false,
    );
    expect(
      machineSchema.safeParse({ ...valid, schoolId: "pas-un-uuid" }).success,
    ).toBe(false);
  });
});

describe("machineUpdateSchema et machineStatusSchema", () => {
  it("ne contient pas l'école : une machine ne change pas d'école", () => {
    const parsed = machineUpdateSchema.parse({
      machineId: MACHINE_ID,
      schoolId: SCHOOL_ID,
      label: "PC 5",
      kind: "ordinateur",
      serialNumber: "",
    });
    expect("schoolId" in parsed).toBe(false);
  });

  it("n'accepte que actif ou archive", () => {
    expect(
      machineStatusSchema.safeParse({
        machineId: MACHINE_ID,
        status: "supprime",
      }).success,
    ).toBe(false);
    expect(
      machineStatusSchema.safeParse({
        machineId: MACHINE_ID,
        status: "archive",
      }).success,
    ).toBe(true);
  });
});
