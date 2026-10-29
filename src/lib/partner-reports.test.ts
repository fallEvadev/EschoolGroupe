import { describe, expect, it } from "vitest";

import {
  courseLine,
  groupReportsByDay,
  schoolsOf,
  toPartnerReport,
  type PartnerReportRow,
} from "./partner-reports";

const row = (over: Partial<PartnerReportRow> = {}): PartnerReportRow => ({
  out_id: "r1",
  out_school_id: "s1",
  out_school_name: "École A",
  out_report_date: "2026-10-29",
  out_slot_starts: "08:00:00",
  out_slot_ends: "09:30:00",
  out_formateur: "Fatou Diop",
  out_courses: [
    {
      startsAt: "08:00",
      endsAt: "09:30",
      classes: "3e A",
      theme: "Algèbre",
      headcount: 25,
    },
  ],
  out_classes: "3e A",
  out_course_theme: "Algèbre",
  ...over,
});

describe("toPartnerReport", () => {
  it("formate l'horaire et lit les cours", () => {
    const report = toPartnerReport(row());
    expect(report.slot).toBe("08:00–09:30");
    expect(report.formateur).toBe("Fatou Diop");
    expect(report.courses).toHaveLength(1);
  });

  it("transforme un ancien rapport (sans cours) en un seul cours", () => {
    const report = toPartnerReport(row({ out_courses: [] }));
    expect(report.courses).toEqual([
      {
        startsAt: "",
        endsAt: "",
        classes: "3e A",
        theme: "Algèbre",
        headcount: null,
      },
    ]);
  });
});

describe("groupReportsByDay", () => {
  const reports = [
    toPartnerReport(row({ out_id: "a", out_report_date: "2026-10-29" })),
    toPartnerReport(row({ out_id: "b", out_report_date: "2026-10-29" })),
    toPartnerReport(
      row({
        out_id: "c",
        out_report_date: "2026-10-28",
        out_school_id: "s2",
        out_school_name: "École B",
      }),
    ),
  ];

  it("regroupe par jour en gardant l'ordre", () => {
    const days = groupReportsByDay(reports);
    expect(days.map((d) => [d.date, d.reports.length])).toEqual([
      ["2026-10-29", 2],
      ["2026-10-28", 1],
    ]);
  });

  it("filtre par école", () => {
    const days = groupReportsByDay(reports, "s2");
    expect(days).toHaveLength(1);
    expect(days[0]?.reports[0]?.id).toBe("c");
  });

  it("liste les écoles par ordre alphabétique, sans doublon", () => {
    expect(schoolsOf(reports).map((s) => s.name)).toEqual([
      "École A",
      "École B",
    ]);
  });
});

describe("courseLine", () => {
  it("assemble les éléments présents", () => {
    expect(
      courseLine({
        startsAt: "08:00",
        endsAt: "09:00",
        classes: "3e A",
        theme: "Algèbre",
        headcount: 25,
      }),
    ).toBe("08:00–09:00 · 3e A · Algèbre · 25 élèves");
  });

  it("saute les heures et l'effectif absents, et accorde le singulier", () => {
    expect(
      courseLine({
        startsAt: "",
        endsAt: "",
        classes: "CM2",
        theme: "Lecture",
        headcount: null,
      }),
    ).toBe("CM2 · Lecture");
    expect(
      courseLine({
        startsAt: "",
        endsAt: "",
        classes: "CM2",
        theme: "Lecture",
        headcount: 1,
      }),
    ).toBe("CM2 · Lecture · 1 élève");
  });
});
