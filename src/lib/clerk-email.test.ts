import { describe, expect, it } from "vitest";

import { primaryEmail } from "./clerk-email";

const base = {
  primary_email_address_id: "idn_1",
  email_addresses: [
    {
      id: "idn_1",
      email_address: "Awa.Fall@Exemple.sn",
      verification: { status: "verified" },
    },
    {
      id: "idn_2",
      email_address: "autre@exemple.sn",
      verification: { status: "unverified" },
    },
  ],
};

describe("primaryEmail", () => {
  it("renvoie l'adresse principale en minuscules, vérifiée", () => {
    expect(primaryEmail(base)).toEqual({
      address: "awa.fall@exemple.sn",
      verified: true,
    });
  });

  it("signale une adresse principale non vérifiée", () => {
    expect(
      primaryEmail({ ...base, primary_email_address_id: "idn_2" }),
    ).toEqual({ address: "autre@exemple.sn", verified: false });
  });

  it.each(["unverified", "failed", "expired", "transferable"])(
    "ne considère pas le statut « %s » comme vérifié",
    (status) => {
      const result = primaryEmail({
        primary_email_address_id: "idn_1",
        email_addresses: [
          {
            id: "idn_1",
            email_address: "a@b.sn",
            verification: { status },
          },
        ],
      });
      expect(result.verified).toBe(false);
    },
  );

  it("considère une adresse sans information de vérification comme non vérifiée", () => {
    expect(
      primaryEmail({
        primary_email_address_id: "idn_1",
        email_addresses: [
          { id: "idn_1", email_address: "a@b.sn", verification: null },
        ],
      }).verified,
    ).toBe(false);
  });

  it("renvoie une adresse vide quand il n'y a pas d'adresse principale", () => {
    expect(
      primaryEmail({ primary_email_address_id: null, email_addresses: [] }),
    ).toEqual({ address: "", verified: false });
  });
});
