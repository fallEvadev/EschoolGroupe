import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  BILAN_KIND_LABELS,
  bilanTitle,
  periodLabel,
  type BilanKind,
} from "@/lib/bilans";
import { formatClock, formatDate } from "@/lib/dates";
import { fitInBox, type ImageSize } from "@/lib/image-size";
import { formatTime } from "@/lib/schools";

/** Couleurs de la charte (variables de thème de l'application, reprises ici car Word ne les connaît pas). */
const COLORS = {
  primary: "2952D9",
  navy: "0B1A47",
  muted: "5B6785",
  line: "D5DAE8",
  soft: "EEF2FD",
  warning: "9A5B00",
} as const;

const FONT = "Calibri";

export type DocImage = {
  data: Uint8Array;
  type: "png" | "jpg";
  size: ImageSize;
};

export type BilanDocIssue = { equipment: string; description: string };

/** Un rapport validé tel qu'il apparaît dans le bilan. */
export type BilanDocReport = {
  /** Date du rapport, « aaaa-mm-jj ». */
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Heure réelle d'arrivée (ISO), `null` si le pointage n'est pas connu. */
  arrivedAt?: string | null;
  /** Heure réelle de descente (ISO), `null` tant qu'elle n'est pas validée. */
  departedAt?: string | null;
  formateur: string;
  classes: string;
  courseTheme: string;
  equipmentOk: boolean;
  issues: BilanDocIssue[];
};

export type BilanDocData = {
  organizationName: string;
  academicYear: string;
  schoolName: string;
  kind: BilanKind;
  /** Début de période, « aaaa-mm-jj ». */
  periodStart: string;
  reports: BilanDocReport[];
  logo: DocImage | null;
  signature: DocImage | null;
  /** Date de génération, « aaaa-mm-jj ». */
  generatedOn: string;
};

/** Rapports triés par date puis par heure de début. */
export function sortReports(reports: BilanDocReport[]): BilanDocReport[] {
  return [...reports].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
  );
}

export type BilanSummary = {
  sessions: number;
  formateurs: number;
  issues: number;
  reportsWithIssues: number;
};

/** Les chiffres du résumé : séances, formateurs différents, pannes signalées. */
export function summarizeReports(reports: BilanDocReport[]): BilanSummary {
  return {
    sessions: reports.length,
    formateurs: new Set(reports.map((r) => r.formateur.trim().toLowerCase()))
      .size,
    issues: reports.reduce((sum, r) => sum + r.issues.length, 0),
    reportsWithIssues: reports.filter((r) => r.issues.length > 0).length,
  };
}

export { bilanTitle };

/**
 * Nom du fichier à télécharger : lettres, chiffres et tirets seulement (aucun
 * accent ni caractère spécial qui poserait problème dans un en-tête HTTP).
 */
export function bilanFileName(
  schoolName: string,
  kind: BilanKind,
  periodStart: string,
): string {
  const school =
    schoolName
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "ecole";
  return `bilan-${kind === "semaine" ? "semaine" : "mois"}-${periodStart}-${school}.docx`;
}

function day(iso: string): string {
  return formatDate(`${iso}T12:00:00Z`);
}

/**
 * Horaire du cours : les heures RÉELLES (arrivée et descente) quand elles sont
 * connues, sinon l'horaire prévu du créneau (anciens pointages).
 */
export function timeRange(report: BilanDocReport): string {
  if (report.arrivedAt && report.departedAt) {
    return `${formatClock(report.arrivedAt)} – ${formatClock(report.departedAt)}`;
  }
  return report.startsAt && report.endsAt
    ? `${formatTime(report.startsAt)} – ${formatTime(report.endsAt)}`
    : "—";
}

function text(
  value: string,
  options: {
    bold?: boolean;
    color?: string;
    size?: number;
    italics?: boolean;
  } = {},
): TextRun {
  return new TextRun({
    text: value,
    font: FONT,
    bold: options.bold,
    italics: options.italics,
    color: options.color ?? COLORS.navy,
    size: options.size ?? 21,
  });
}

function paragraph(
  children: TextRun[],
  options: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.align,
    spacing: { after: options.after ?? 80 },
    children,
  });
}

function image(
  source: DocImage,
  maxWidth: number,
  maxHeight: number,
  name: string,
): ImageRun {
  const { width, height } = fitInBox(source.size, maxWidth, maxHeight);
  return new ImageRun({
    type: source.type,
    data: source.data,
    transformation: { width, height },
    altText: { name, title: name, description: name },
  });
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLORS.line };
const BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
};

function cell(
  width: number,
  children: Paragraph[],
  options: { header?: boolean } = {},
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    shading: options.header
      ? { type: ShadingType.CLEAR, fill: COLORS.primary, color: "auto" }
      : undefined,
    children,
  });
}

function cellText(
  value: string,
  options: { header?: boolean } = {},
): Paragraph[] {
  return [
    paragraph(
      [
        text(value, {
          bold: options.header,
          color: options.header ? "FFFFFF" : COLORS.navy,
          size: 19,
        }),
      ],
      { after: 0 },
    ),
  ];
}

/** Largeurs des colonnes (en vingtièmes de point) : le total tient dans une page A4 paysage. */
const COLUMNS = [1400, 1300, 2100, 1800, 4000, 4200] as const;
const TABLE_WIDTH = COLUMNS.reduce((sum, w) => sum + w, 0);

function materialCell(report: BilanDocReport): Paragraph[] {
  if (report.equipmentOk) {
    return [paragraph([text("Tout fonctionne", { size: 19 })], { after: 0 })];
  }
  return report.issues.map((issue) =>
    paragraph(
      [
        text(`${issue.equipment} : `, {
          bold: true,
          color: COLORS.warning,
          size: 19,
        }),
        text(issue.description, { size: 19 }),
      ],
      { after: 40 },
    ),
  );
}

function reportsTable(reports: BilanDocReport[]): Table {
  const headers = [
    "Date",
    "Horaire",
    "Formateur",
    "Classes",
    "Thème du cours",
    "Matériel",
  ];
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [...COLUMNS],
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((label, i) =>
          cell(COLUMNS[i] ?? 2000, cellText(label, { header: true }), {
            header: true,
          }),
        ),
      }),
      ...reports.map(
        (report) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell(COLUMNS[0], cellText(day(report.date))),
              cell(COLUMNS[1], cellText(timeRange(report))),
              cell(COLUMNS[2], cellText(report.formateur)),
              cell(COLUMNS[3], cellText(report.classes || "—")),
              cell(COLUMNS[4], cellText(report.courseTheme || "—")),
              cell(COLUMNS[5], materialCell(report)),
            ],
          }),
      ),
    ],
  });
}

function summaryParagraphs(summary: BilanSummary): Paragraph[] {
  const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
  const lines = [
    `${summary.sessions} ${plural(summary.sessions, "séance validée", "séances validées")}`,
    `${summary.formateurs} ${plural(summary.formateurs, "formateur", "formateurs")}`,
    summary.issues === 0
      ? "Aucune panne signalée"
      : `${summary.issues} ${plural(summary.issues, "panne signalée", "pannes signalées")} sur ${summary.reportsWithIssues} ${plural(summary.reportsWithIssues, "rapport", "rapports")}`,
  ];
  return lines.map(
    (line) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 40 },
        children: [text(line)],
      }),
  );
}

function headingBar(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 8,
        color: COLORS.primary,
        space: 4,
      },
    },
    children: [
      text(label.toUpperCase(), {
        bold: true,
        color: COLORS.primary,
        size: 22,
      }),
    ],
  });
}

/** Construit le fichier Word du bilan (format .docx, modifiable dans Word). */
export async function buildBilanDocx(data: BilanDocData): Promise<Uint8Array> {
  const reports = sortReports(data.reports);
  const summary = summarizeReports(reports);

  const header: Paragraph[] = [];
  if (data.logo) {
    header.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [image(data.logo, 190, 70, "Logo")],
      }),
    );
  }
  header.push(
    paragraph(
      [
        text(bilanTitle(data.kind), {
          bold: true,
          color: COLORS.primary,
          size: 40,
        }),
      ],
      {
        after: 60,
      },
    ),
    paragraph([text(data.schoolName, { bold: true, size: 30 })], { after: 40 }),
    paragraph(
      [
        text(periodLabel(data.kind, data.periodStart), {
          color: COLORS.muted,
          size: 24,
        }),
      ],
      {
        after: 40,
      },
    ),
    paragraph(
      [
        text(`${data.organizationName} · année scolaire ${data.academicYear}`, {
          color: COLORS.muted,
          size: 20,
        }),
      ],
      { after: 120 },
    ),
  );

  const body: (Paragraph | Table)[] = [
    ...header,
    headingBar("Synthèse"),
    ...summaryParagraphs(summary),
    headingBar(
      `Rapports de la période (${BILAN_KIND_LABELS[data.kind].toLowerCase()})`,
    ),
    reportsTable(reports),
  ];

  const signature: Paragraph[] = [
    new Paragraph({
      spacing: { before: 480, after: 80 },
      keepNext: true,
      children: [
        text(`Fait le ${day(data.generatedOn)}`, { color: COLORS.muted }),
      ],
    }),
  ];
  if (data.signature) {
    signature.push(
      new Paragraph({
        spacing: { after: 40 },
        keepNext: true,
        children: [image(data.signature, 180, 70, "Signature")],
      }),
    );
  }
  signature.push(
    paragraph([text("La Direction pédagogique", { bold: true })], { after: 0 }),
    paragraph([text(data.organizationName, { color: COLORS.muted })], {
      after: 0,
    }),
  );

  const document = new Document({
    creator: data.organizationName,
    title: `${bilanTitle(data.kind)} · ${data.schoolName}`,
    description: periodLabel(data.kind, data.periodStart),
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 11906,
              height: 16838,
            },
            margin: { top: 900, bottom: 900, left: 900, right: 900 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    font: FONT,
                    size: 17,
                    color: COLORS.muted,
                    children: [
                      `${data.organizationName} · ${data.schoolName} · page `,
                      PageNumber.CURRENT,
                      " / ",
                      PageNumber.TOTAL_PAGES,
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...body, ...signature],
      },
    ],
  });

  return new Uint8Array(await Packer.toBuffer(document));
}
