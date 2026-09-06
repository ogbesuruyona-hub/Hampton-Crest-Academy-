import { describe, expect, it } from "vitest";
import { canAccessRole, classifyRequestError, resolveCollectionState } from "./requestState";

describe("request states", () => {
  it.each([[401, "session"], [403, "forbidden"], [500, "server"]])("clasifica HTTP %i", (status, kind) => {
    expect(classifyRequestError({ response: { status } }).kind).toBe(kind);
  });

  it("distingue red, vacío, carga y datos", () => {
    expect(classifyRequestError(new Error("offline")).kind).toBe("network");
    expect(resolveCollectionState({ loading: true, items: [] })).toBe("loading");
    expect(resolveCollectionState({ loading: false, items: [] })).toBe("empty");
    expect(resolveCollectionState({ loading: false, items: [{ id: 1 }] })).toBe("ready");
  });

  it("impide que un miembro normal abra rutas administrativas", () => {
    expect(canAccessRole({ role: "member" }, "admin")).toBe(false);
    expect(canAccessRole({ role: "admin" }, "admin")).toBe(true);
  });
});
