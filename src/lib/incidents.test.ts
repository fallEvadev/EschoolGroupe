import { describe, expect, it } from "vitest";

import {
  buildClaudeReport,
  cleanMessage,
  cleanStack,
  incidentFingerprint,
  isExpectedError,
  maskSensitive,
  sortIncidents,
  stripQuery,
  type IncidentView,
} from "./incidents";

describe("maskSensitive", () => {
  it("masque les adresses e-mail", () => {
    expect(maskSensitive("échec pour awa.fall60@unchk.edu.sn ici")).toBe(
      "échec pour [e-mail] ici",
    );
  });

  it("masque les numéros de téléphone", () => {
    expect(maskSensitive("appel au +221 77 123 45 67 refusé")).toBe(
      "appel au [numéro] refusé",
    );
  });

  it("remplace les identifiants par <id>", () => {
    expect(
      maskSensitive("pointage 5f0c2c1e-6c1f-4a43-9a5b-3d1b2f6e8a10 introuvable"),
    ).toBe("pointage <id> introuvable");
  });

  it("masque les jetons et les clés", () => {
    expect(maskSensitive("Bearer abc.def.ghi refusé")).toBe(
      "Bearer [jeton] refusé",
    );
    expect(maskSensitive("clé sk_test_ABCDEFGHIJKL invalide")).toBe(
      "clé [clé] invalide",
    );
    expect(
      maskSensitive("jeton eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl"),
    ).toBe("jeton [jeton]");
  });

  it("laisse un message ordinaire intact", () => {
    const text = "Cannot read properties of undefined (reading 'courses')";
    expect(maskSensitive(text)).toBe(text);
  });
});

describe("cleanMessage", () => {
  it("nettoie, resserre les espaces et borne la longueur", () => {
    expect(cleanMessage(new Error("  une   erreur\n\n sur   awa@exemple.sn "))).toBe(
      "une erreur sur [e-mail]",
    );
    expect(cleanMessage(new Error("mot ".repeat(500))).length).toBe(600);
  });

  it("gère une erreur sans message", () => {
    expect(cleanMessage(undefined)).toBe("Erreur sans message");
    expect(cleanMessage(new Error(""))).toBe("Erreur sans message");
    expect(cleanMessage("texte simple")).toBe("texte simple");
  });
});

describe("cleanStack", () => {
  it("renvoie null sans trace, et masque les données dans la trace", () => {
    expect(cleanStack("pas une erreur")).toBeNull();
    const error = new Error("m");
    error.stack = "Error: m\n    at f (a@b.com:1:1)";
    expect(cleanStack(error)).toContain("[e-mail]");
  });
});

describe("stripQuery", () => {
  it("retire les paramètres et l'ancre", () => {
    expect(stripQuery("/formateur/cahiers?x=1#a")).toBe("/formateur/cahiers");
    expect(stripQuery("")).toBeNull();
    expect(stripQuery(undefined)).toBeNull();
  });
});

describe("incidentFingerprint", () => {
  const base = {
    routePath: "/(formateur)/formateur/cahiers/[id]",
    routeType: "render",
  };

  it("regroupe les erreurs qui ne diffèrent que par un nombre", () => {
    expect(
      incidentFingerprint({ ...base, message: "ligne 12 invalide" }),
    ).toBe(incidentFingerprint({ ...base, message: "ligne 48 invalide" }));
  });

  it("sépare des pages ou des messages différents", () => {
    const a = incidentFingerprint({ ...base, message: "erreur A" });
    expect(a).not.toBe(incidentFingerprint({ ...base, message: "erreur B" }));
    expect(a).not.toBe(
      incidentFingerprint({ ...base, routePath: "/autre", message: "erreur A" }),
    );
  });

  it("a la longueur attendue par la base (8 à 128 caractères)", () => {
    const f = incidentFingerprint({ ...base, message: "m" });
    expect(f.length).toBeGreaterThanOrEqual(8);
    expect(f.length).toBeLessThanOrEqual(128);
    expect(f).toMatch(/^[0-9a-f]+$/);
  });
});

describe("isExpectedError", () => {
  it("ignore les redirections et les pages introuvables de Next.js", () => {
    expect(isExpectedError({ digest: "NEXT_REDIRECT;replace;/x;307;" })).toBe(
      true,
    );
    expect(isExpectedError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(isExpectedError({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(
      true,
    );
  });

  it("garde les vraies erreurs", () => {
    expect(isExpectedError(new Error("bug"))).toBe(false);
    expect(isExpectedError({ digest: "1234567" })).toBe(false);
    expect(isExpectedError(null)).toBe(false);
  });
});

const incident = (patch: Partial<IncidentView> = {}): IncidentView => ({
  id: "1",
  source: "serveur",
  routePath: "/(formateur)/formateur/cahiers/[attendanceId]",
  requestPath: "/formateur/cahiers/<id>",
  routeType: "render",
  message: "Cannot read properties of undefined",
  digest: "123456",
  stack: "Error: x\n    at Page",
  userRole: "formateur",
  userAgent: "Mozilla",
  status: "nouveau",
  occurrences: 3,
  firstSeenAt: "2026-10-24T10:00:00Z",
  lastSeenAt: "2026-10-24T11:00:00Z",
  note: null,
  ...patch,
});

describe("sortIncidents", () => {
  it("met les nouveaux d'abord, puis en cours, puis résolus, du plus récent au plus ancien", () => {
    const sorted = sortIncidents([
      incident({ id: "r", status: "resolu", lastSeenAt: "2026-10-24T12:00:00Z" }),
      incident({ id: "n1", status: "nouveau", lastSeenAt: "2026-10-24T09:00:00Z" }),
      incident({ id: "c", status: "en_cours", lastSeenAt: "2026-10-24T08:00:00Z" }),
      incident({ id: "n2", status: "nouveau", lastSeenAt: "2026-10-24T10:00:00Z" }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["n2", "n1", "c", "r"]);
  });
});

describe("buildClaudeReport", () => {
  it("contient tout ce qu'il faut pour retrouver le fichier", () => {
    const text = buildClaudeReport(incident(), (iso) => `le ${iso}`);
    expect(text).toContain("/(formateur)/formateur/cahiers/[attendanceId]");
    expect(text).toContain("Cannot read properties of undefined");
    expect(text).toContain("123456");
    expect(text).toContain("vu 3 fois");
    expect(text).toContain("affichage d'une page");
    expect(text).toContain("Demande :");
  });

  it("gère les informations absentes", () => {
    const text = buildClaudeReport(
      incident({ digest: null, stack: null, userRole: null, requestPath: null }),
      () => "x",
    );
    expect(text).toContain("aucun");
    expect(text).toContain("inconnu");
    expect(text).not.toContain("Début de la trace");
  });
});
