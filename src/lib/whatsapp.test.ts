import { describe, expect, it } from "vitest";

import {
  buildWhatsAppUrl,
  directorCodeMessage,
  invitationMessage,
  toWhatsAppNumber,
  trainersCodeMessage,
} from "./whatsapp";

describe("directorCodeMessage", () => {
  const text = directorCodeMessage({
    firstName: "Moussa",
    schoolName: "Campus Dakar-Plateau",
    dateLabel: "mercredi 7 octobre",
    code: "428 105",
  });

  it("contient le prénom, l'école, le jour et le code", () => {
    expect(text).toContain("Bonjour Moussa,");
    expect(text).toContain("Campus Dakar-Plateau");
    expect(text).toContain("mercredi 7 octobre");
    expect(text).toContain("428 105");
  });

  it("demande de ne le donner qu'aux formateurs présents", () => {
    expect(text).toContain("formateurs présents");
    expect(text).toContain("ne pas le diffuser");
  });

  it("devient un lien WhatsApp vers le directeur", () => {
    const url = buildWhatsAppUrl("77 123 45 67", text);
    expect(url.startsWith("https://wa.me/221771234567?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1] ?? "")).toBe(text);
  });
});

describe("trainersCodeMessage", () => {
  it("donne l'école, le jour, le code et sa durée de validité", () => {
    const text = trainersCodeMessage({
      schoolName: "Campus Dakar-Plateau",
      dateLabel: "mercredi 7 octobre",
      code: "428 105",
    });
    expect(text).toContain("Campus Dakar-Plateau");
    expect(text).toContain("428 105");
    expect(text).toContain("Valable aujourd'hui seulement.");
  });

  it("ne s'adresse à personne en particulier", () => {
    expect(
      trainersCodeMessage({
        schoolName: "A",
        dateLabel: "lundi 5 octobre",
        code: "000 000",
      }),
    ).not.toContain("Bonjour");
  });
});

describe("toWhatsAppNumber", () => {
  it.each([
    ["771234567", "221771234567"],
    ["77 123 45 67", "221771234567"],
    ["+221771234567", "221771234567"],
    ["00221 33 812 34 56", "221338123456"],
  ])("convertit %s en %s", (input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  it("refuse un numéro vide ou trop court", () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("12345")).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("vise le numéro avec le message encodé", () => {
    expect(buildWhatsAppUrl("771234567", "Bonjour Awa")).toBe(
      "https://wa.me/221771234567?text=Bonjour%20Awa",
    );
  });

  it("laisse choisir le contact sans numéro", () => {
    expect(buildWhatsAppUrl(null, "Bonjour")).toBe(
      "https://wa.me/?text=Bonjour",
    );
  });
});

describe("invitationMessage", () => {
  it("contient le prénom, le rôle et le lien", () => {
    const text = invitationMessage({
      firstName: "Awa",
      organizationName: "E-School Groupe",
      roleLabel: "Formateur",
      url: "https://exemple.sn/lien",
      validDays: 7,
    });
    expect(text).toContain("Bonjour Awa,");
    expect(text).toContain("(Formateur)");
    expect(text).toContain("valable 7 jours");
    expect(text.endsWith("https://exemple.sn/lien")).toBe(true);
  });
});
