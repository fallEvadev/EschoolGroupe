import { describe, expect, it } from "vitest";

import { classifySupabaseError } from "./errors";

describe("classifySupabaseError", () => {
  it("reconnaît un jeton Clerk refusé", () => {
    expect(
      classifySupabaseError({
        code: "PGRST301",
        message: "No suitable key or wrong key type",
      }),
    ).toBe("auth");
    expect(
      classifySupabaseError({ message: "No suitable key or wrong key type" }),
    ).toBe("auth");
  });

  it("reconnaît une table absente", () => {
    expect(
      classifySupabaseError({ code: "PGRST205", message: "table not found" }),
    ).toBe("migration");
    expect(
      classifySupabaseError({
        code: "42P01",
        message: "relation does not exist",
      }),
    ).toBe("migration");
  });

  it("laisse les autres erreurs en « other »", () => {
    expect(
      classifySupabaseError({ code: "23505", message: "duplicate key" }),
    ).toBe("other");
  });
});
