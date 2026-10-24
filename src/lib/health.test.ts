import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "./health";

const base = {
  supabaseUrl: "https://exemple.supabase.co/",
  anonKey: "cle-publique",
};

describe("checkHealth", () => {
  it("signale ok quand la base répond", async () => {
    const fetchFn = vi.fn(async () => new Response("null", { status: 200 }));
    const report = await checkHealth({ ...base, fetchFn });
    expect(report.ok).toBe(true);
    expect(report.db).toBe(true);
    // Appel de la fonction publique, sans double barre dans l'adresse.
    expect(fetchFn).toHaveBeenCalledWith(
      "https://exemple.supabase.co/rest/v1/rpc/current_user_role",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("signale pas ok quand la base répond par une erreur", async () => {
    const fetchFn = vi.fn(async () => new Response("erreur", { status: 500 }));
    const report = await checkHealth({ ...base, fetchFn });
    expect(report.ok).toBe(false);
    expect(report.db).toBe(false);
  });

  it("signale pas ok quand le réseau échoue, sans laisser fuir le message", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:443 cle-secrete");
    });
    const report = await checkHealth({ ...base, fetchFn });
    expect(report).toEqual({ ok: false, db: false, ms: expect.any(Number) });
    expect(JSON.stringify(report)).not.toContain("cle-secrete");
  });

  it("signale pas ok sans configuration, sans appeler le réseau", async () => {
    const fetchFn = vi.fn();
    const report = await checkHealth({
      supabaseUrl: undefined,
      anonKey: undefined,
      fetchFn,
    });
    expect(report.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("abandonne quand la base met trop de temps à répondre", async () => {
    const fetchFn = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    ) as unknown as typeof fetch;
    const report = await checkHealth({ ...base, fetchFn, timeoutMs: 20 });
    expect(report.ok).toBe(false);
  });
});
