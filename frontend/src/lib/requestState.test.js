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

  it.each([
    ["AdminQuizzes 403", { response: { status: 403 } }, "forbidden"],
    ["AdminQuizzes 500", { response: { status: 500 } }, "server"],
    ["MemberDirectory red", new Error("offline"), "network"],
    ["AccessDenied membership config 500", { response: { status: 503 } }, "server"],
  ])("mantiene un estado de error explícito para %s", (_name, error, expected) => {
    expect(resolveCollectionState({ loading: false, error, items: [] })).toBe(expected);
    expect(classifyRequestError(error).kind).toBe(expected);
  });
});
