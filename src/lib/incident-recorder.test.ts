import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({ rpc }),
}));

import { recordIncident } from "./incident-recorder";

/** Les 10 paramètres que la fonction SQL `record_incident` exige tous. */
const EXPECTED_KEYS = [
  "p_digest",
  "p_fingerprint",
  "p_message",
  "p_request_path",
  "p_route_path",
  "p_route_type",
  "p_source",
  "p_stack",
  "p_user_agent",
  "p_user_role",
];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: "id", error: null });
});

describe("recordIncident", () => {
  it("envoie toujours les 10 paramètres, même quand certains sont absents", async () => {
    await recordIncident({
      source: "serveur",
      routePath: "/(formateur)/formateur/cahiers/[id]",
      error: new Error("boum"),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("record_incident");
    // Une clé à `undefined` serait omise du corps de la requête : la fonction
    // serait alors introuvable. Chaque clé doit exister, valeur ou `null`.
    expect(Object.keys(args).sort()).toEqual(EXPECTED_KEYS);
    for (const key of EXPECTED_KEYS) {
      expect(args[key]).not.toBeUndefined();
    }
    expect(JSON.parse(JSON.stringify(args))).toHaveProperty("p_digest", null);
  });

  it("masque les données sensibles avant d'écrire", async () => {
    await recordIncident({
      source: "serveur",
      routePath: "/x",
      requestPath: "/formateur/cahiers?token=abc",
      error: new Error("échec pour awa@exemple.sn"),
    });
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args.p_message).toBe("échec pour [e-mail]");
    expect(args.p_request_path).toBe("/formateur/cahiers");
  });

  it("reprend le digest de l'erreur", async () => {
    const error = Object.assign(new Error("m"), { digest: "123456" });
    await recordIncident({ source: "serveur", routePath: "/x", error });
    expect(rpc.mock.calls[0]?.[1]).toHaveProperty("p_digest", "123456");
  });

  it("n'enregistre pas une redirection ni une page introuvable", async () => {
    await recordIncident({
      source: "serveur",
      routePath: "/x",
      error: Object.assign(new Error("r"), { digest: "NEXT_REDIRECT;a;/b;307;" }),
    });
    await recordIncident({
      source: "serveur",
      routePath: "/x",
      error: Object.assign(new Error("n"), { digest: "NEXT_NOT_FOUND" }),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ne lève jamais d'erreur, même si la base échoue", async () => {
    rpc.mockRejectedValue(new Error("réseau coupé"));
    await expect(
      recordIncident({ source: "navigateur", routePath: "/x", error: "bug" }),
    ).resolves.toBeUndefined();

    rpc.mockResolvedValue({ data: null, error: { message: "refusé" } });
    await expect(
      recordIncident({ source: "navigateur", routePath: "/x", error: "bug" }),
    ).resolves.toBeUndefined();
  });
});
