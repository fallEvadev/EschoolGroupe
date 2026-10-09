import { describe, expect, it } from "vitest";

import {
  DRAFT_TTL_DAYS,
  draftsToPurge,
  sameContent,
  shouldOfferDraft,
  shouldSaveDraft,
  type ReportDraft,
} from "@/lib/offline/report-drafts";
import { EMPTY_CONTENT, type ReportContent } from "@/lib/reports";

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const content: ReportContent = {
  classes: "3e A",
  courseTheme: "Les tableurs",
  equipmentOk: false,
  issues: [{ equipment: "PC 4", description: "Ne démarre plus" }],
};

function draft(patch: Partial<ReportDraft> = {}): ReportDraft {
  return {
    attendanceId: "a1",
    ownerId: "user_1",
    content,
    updatedAt: NOW - DAY,
    ...patch,
  };
}

describe("sameContent", () => {
  it("ignore les espaces autour des textes", () => {
    expect(
      sameContent(content, {
        ...content,
        classes: "  3e A ",
        courseTheme: "Les tableurs  ",
      }),
    ).toBe(true);
  });

  it("voit une différence dans les pannes", () => {
    const other = {
      ...content,
      issues: [{ equipment: "PC 5", description: "Ne démarre plus" }],
    };
    expect(sameContent(content, other)).toBe(false);
  });
});

describe("shouldOfferDraft", () => {
  it("propose un brouillon récent, à soi, différent du serveur", () => {
    expect(shouldOfferDraft(draft(), "user_1", EMPTY_CONTENT, NOW)).toBe(true);
  });

  it("ne propose rien sans brouillon", () => {
    expect(shouldOfferDraft(undefined, "user_1", EMPTY_CONTENT, NOW)).toBe(
      false,
    );
  });

  it("ne propose pas le brouillon d'un autre compte", () => {
    expect(shouldOfferDraft(draft(), "user_2", EMPTY_CONTENT, NOW)).toBe(false);
  });

  it("ne propose pas un brouillon identique à la version du serveur", () => {
    expect(shouldOfferDraft(draft(), "user_1", content, NOW)).toBe(false);
  });

  it("ne propose pas un brouillon expiré", () => {
    const old = draft({ updatedAt: NOW - (DRAFT_TTL_DAYS + 1) * DAY });
    expect(shouldOfferDraft(old, "user_1", EMPTY_CONTENT, NOW)).toBe(false);
  });
});

describe("shouldSaveDraft", () => {
  it("n'écrit rien tant que la saisie égale la version du serveur", () => {
    expect(shouldSaveDraft(EMPTY_CONTENT, EMPTY_CONTENT)).toBe(false);
  });

  it("écrit dès que la saisie diffère", () => {
    expect(shouldSaveDraft(content, EMPTY_CONTENT)).toBe(true);
  });
});

describe("draftsToPurge", () => {
  it("efface les brouillons expirés et ceux d'un autre compte, garde les autres", () => {
    const drafts = [
      draft({ attendanceId: "garde" }),
      draft({ attendanceId: "autre-compte", ownerId: "user_2" }),
      draft({
        attendanceId: "expire",
        updatedAt: NOW - (DRAFT_TTL_DAYS + 1) * DAY,
      }),
    ];
    expect(draftsToPurge(drafts, "user_1", NOW)).toEqual([
      "autre-compte",
      "expire",
    ]);
  });
});
