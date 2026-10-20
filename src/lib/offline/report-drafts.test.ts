import { describe, expect, it } from "vitest";

import {
  DRAFT_TTL_DAYS,
  draftsToPurge,
  sameContent,
  shouldOfferDraft,
  shouldSaveDraft,
  upgradeContent,
  type ReportDraft,
} from "@/lib/offline/report-drafts";
import { EMPTY_CONTENT, type ReportContent } from "@/lib/reports";

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const content: ReportContent = {
  courses: [
    {
      startsAt: "08:00",
      endsAt: "09:00",
      classes: "3e A",
      theme: "Les tableurs",
      headcount: 25,
    },
  ],
  equipmentOk: false,
  issues: [
    { machineId: "m-1", equipment: "PC 4", description: "Ne démarre plus" },
  ],
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
        courses: [
          { ...content.courses[0], classes: "  3e A ", theme: "Les tableurs  " },
        ],
      }),
    ).toBe(true);
  });

  it("voit un cours ajouté ou un effectif changé", () => {
    const more = {
      ...content,
      courses: [...content.courses, { ...content.courses[0], classes: "CM1" }],
    };
    expect(sameContent(content, more)).toBe(false);
    const other = {
      ...content,
      courses: [{ ...content.courses[0], headcount: 26 }],
    };
    expect(sameContent(content, other)).toBe(false);
  });

  it("voit une différence dans les pannes", () => {
    const other = {
      ...content,
      issues: [
        { machineId: "m-2", equipment: "PC 5", description: "Ne démarre plus" },
      ],
    };
    expect(sameContent(content, other)).toBe(false);
  });

  it("voit une différence de machine à nom identique", () => {
    const other = {
      ...content,
      issues: [{ ...content.issues[0], machineId: null }],
    };
    expect(sameContent(content, other)).toBe(false);
  });

  it("lit un ancien brouillon sans machineId comme « aucune machine »", () => {
    const old = {
      ...content,
      // Brouillon écrit avant le Lot 5 : la clé machineId n'existe pas.
      issues: [{ equipment: "PC 4", description: "Ne démarre plus" }],
    } as unknown as ReportContent;
    const withNull = {
      ...content,
      issues: [{ ...content.issues[0], machineId: null }],
    };
    expect(sameContent(old, withNull)).toBe(true);
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

describe("upgradeContent", () => {
  it("convertit un brouillon d'avant les cours multiples en un seul cours", () => {
    const upgraded = upgradeContent({
      classes: "3e A",
      courseTheme: "Les tableurs",
      equipmentOk: true,
      issues: [],
    });
    expect(upgraded.courses).toEqual([
      {
        startsAt: "",
        endsAt: "",
        classes: "3e A",
        theme: "Les tableurs",
        headcount: null,
      },
    ]);
  });

  it("garde les cours d'un brouillon récent", () => {
    expect(upgradeContent(content).courses).toEqual(content.courses);
  });

  it("repart d'un cours vide si rien n'est lisible", () => {
    expect(upgradeContent(undefined).courses).toHaveLength(1);
  });
});
