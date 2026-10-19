import { describe, expect, it } from "vitest";

import { fieldProps } from "./form";

describe("fieldProps", () => {
  it("relie le contrôle à son aide quand tout va bien", () => {
    expect(fieldProps("email", { hint: "Adresse pro" })).toEqual({
      id: "email",
      "aria-invalid": undefined,
      "aria-describedby": "email-hint",
    });
  });

  it("marque le contrôle invalide et le relie à l'erreur, pas à l'aide", () => {
    expect(
      fieldProps("email", { error: "Adresse invalide", hint: "Adresse pro" }),
    ).toEqual({
      id: "email",
      "aria-invalid": true,
      "aria-describedby": "email-error",
    });
  });

  it("n'ajoute rien sans aide ni erreur", () => {
    expect(fieldProps("nom")).toEqual({
      id: "nom",
      "aria-invalid": undefined,
      "aria-describedby": undefined,
    });
  });
});
