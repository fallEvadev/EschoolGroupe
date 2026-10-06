import { describe, expect, it } from "vitest";

import {
  buildWhatsAppUrl,
  invitationMessage,
  toWhatsAppNumber,
} from "./whatsapp";

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
