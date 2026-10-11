import { describe, expect, it } from "vitest";

import { computeTicketStats, formatDuration } from "@/lib/ticket-stats";

const NOW = new Date("2026-10-11T12:00:00Z");

function ticket(
  patch: Partial<{
    schoolId: string;
    status: string;
    openedAt: string;
    resolvedAt: string | null;
  }> = {},
) {
  return {
    schoolId: "s1",
    status: "ouvert",
    openedAt: "2026-10-10T12:00:00Z",
    resolvedAt: null,
    ...patch,
  };
}

describe("computeTicketStats", () => {
  it("renvoie des zéros et aucun délai sans ticket", () => {
    expect(computeTicketStats([], NOW)).toEqual({
      toTreat: 0,
      inProgress: 0,
      resolvedRecently: 0,
      averageResolutionMs: null,
      bySchool: [],
    });
  });

  it("compte les tickets à traiter et en cours", () => {
    const stats = computeTicketStats(
      [
        ticket(),
        ticket(),
        ticket({ status: "en_cours" }),
        ticket({ status: "archive" }),
      ],
      NOW,
    );
    expect(stats.toTreat).toBe(2);
    expect(stats.inProgress).toBe(1);
  });

  it("calcule le délai moyen sur les résolus des 30 derniers jours", () => {
    const stats = computeTicketStats(
      [
        // 2 h
        ticket({
          status: "resolu",
          openedAt: "2026-10-10T10:00:00Z",
          resolvedAt: "2026-10-10T12:00:00Z",
        }),
        // 4 h
        ticket({
          status: "resolu",
          openedAt: "2026-10-09T08:00:00Z",
          resolvedAt: "2026-10-09T12:00:00Z",
        }),
      ],
      NOW,
    );
    expect(stats.resolvedRecently).toBe(2);
    expect(stats.averageResolutionMs).toBe(3 * 60 * 60 * 1000);
  });

  it("ignore les résolutions de plus de 30 jours", () => {
    const stats = computeTicketStats(
      [
        ticket({
          status: "resolu",
          openedAt: "2026-08-01T10:00:00Z",
          resolvedAt: "2026-08-02T10:00:00Z",
        }),
      ],
      NOW,
    );
    expect(stats.resolvedRecently).toBe(0);
    expect(stats.averageResolutionMs).toBeNull();
  });

  it("compte comme résolu un ticket archivé après sa résolution, pas une fausse alerte", () => {
    const stats = computeTicketStats(
      [
        ticket({
          status: "archive",
          openedAt: "2026-10-10T10:00:00Z",
          resolvedAt: "2026-10-10T11:00:00Z",
        }),
        ticket({ status: "archive", resolvedAt: null }),
      ],
      NOW,
    );
    expect(stats.resolvedRecently).toBe(1);
  });

  it("groupe par école, les plus chargées d'abord", () => {
    const stats = computeTicketStats(
      [
        ticket({ schoolId: "a" }),
        ticket({ schoolId: "b" }),
        ticket({ schoolId: "b", status: "en_cours" }),
        ticket({ schoolId: "a", status: "archive" }),
        ticket({ schoolId: "a", status: "archive" }),
      ],
      NOW,
    );
    expect(stats.bySchool).toEqual([
      { schoolId: "b", open: 2, total: 2 },
      { schoolId: "a", open: 1, total: 3 },
    ]);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "moins d'1 h"],
    [30 * 60 * 1000, "moins d'1 h"],
    [5 * 60 * 60 * 1000, "5 h"],
    [47 * 60 * 60 * 1000, "47 h"],
    [3 * 24 * 60 * 60 * 1000, "3 j"],
    [Number.NaN, "moins d'1 h"],
  ])("%s ms -> %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});
