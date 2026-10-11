import { describe, expect, it } from "vitest";

import {
  canArchive,
  canAssign,
  matchesFilter,
  parseTicketFilter,
  sortTickets,
} from "@/lib/tickets";
import {
  archiveTicketSchema,
  assignTicketSchema,
} from "@/lib/validations/tickets";

const ID = "0b6f5d52-1d4c-4a45-8f1a-7c2e9a4d5b33";

describe("parseTicketFilter", () => {
  it("accepte les filtres connus", () => {
    expect(parseTicketFilter("resolu")).toBe("resolu");
    expect(parseTicketFilter("tous")).toBe("tous");
  });

  it("revient à « actifs » pour une valeur inconnue ou absente", () => {
    expect(parseTicketFilter("n'importe quoi")).toBe("actifs");
    expect(parseTicketFilter(undefined)).toBe("actifs");
    expect(parseTicketFilter(["resolu"])).toBe("actifs");
  });
});

describe("matchesFilter", () => {
  it("« actifs » regroupe ouverts et en cours", () => {
    expect(matchesFilter("ouvert", "actifs")).toBe(true);
    expect(matchesFilter("en_cours", "actifs")).toBe(true);
    expect(matchesFilter("resolu", "actifs")).toBe(false);
    expect(matchesFilter("archive", "actifs")).toBe(false);
  });

  it("un filtre précis ne garde que son statut, « tous » garde tout", () => {
    expect(matchesFilter("resolu", "resolu")).toBe(true);
    expect(matchesFilter("ouvert", "resolu")).toBe(false);
    expect(matchesFilter("archive", "tous")).toBe(true);
  });
});

describe("règles d'action", () => {
  it("on n'affecte que les tickets ouverts ou en cours", () => {
    expect(canAssign("ouvert")).toBe(true);
    expect(canAssign("en_cours")).toBe(true);
    expect(canAssign("resolu")).toBe(false);
    expect(canAssign("archive")).toBe(false);
  });

  it("on archive un ticket ouvert ou résolu, pas un ticket en cours", () => {
    expect(canArchive("ouvert")).toBe(true);
    expect(canArchive("resolu")).toBe(true);
    expect(canArchive("en_cours")).toBe(false);
    expect(canArchive("archive")).toBe(false);
  });
});

describe("sortTickets", () => {
  it("met les tickets à traiter d'abord, les plus anciens en tête", () => {
    const sorted = sortTickets([
      { id: "resolu récent", status: "resolu", openedAt: "2026-10-10" },
      { id: "ouvert récent", status: "ouvert", openedAt: "2026-10-09" },
      { id: "en cours", status: "en_cours", openedAt: "2026-10-01" },
      { id: "ouvert ancien", status: "ouvert", openedAt: "2026-10-02" },
      { id: "archivé", status: "archive", openedAt: "2026-09-01" },
      { id: "résolu ancien", status: "resolu", openedAt: "2026-10-03" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([
      "ouvert ancien",
      "ouvert récent",
      "en cours",
      "resolu récent",
      "résolu ancien",
      "archivé",
    ]);
  });
});

describe("schémas de ticket", () => {
  it("accepte une affectation ou un retrait d'affectation", () => {
    expect(
      assignTicketSchema.safeParse({ ticketId: ID, profileId: ID }).success,
    ).toBe(true);
    expect(
      assignTicketSchema.safeParse({ ticketId: ID, profileId: null }).success,
    ).toBe(true);
  });

  it("refuse des identifiants invalides", () => {
    expect(
      assignTicketSchema.safeParse({ ticketId: "x", profileId: ID }).success,
    ).toBe(false);
    expect(
      assignTicketSchema.safeParse({ ticketId: ID, profileId: "x" }).success,
    ).toBe(false);
    expect(archiveTicketSchema.safeParse({ ticketId: "x" }).success).toBe(
      false,
    );
  });
});
