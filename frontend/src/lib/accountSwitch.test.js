import { describe, expect, it, vi } from "vitest";
import { switchAccount } from "./accountSwitch";

describe("switchAccount", () => {
  it("cierra la sesión antes de abrir el login", async () => {
    const calls = [];
    const logout = vi.fn(async () => calls.push("logout"));
    const navigate = vi.fn((path, options) => calls.push([path, options]));

    await switchAccount(logout, navigate);

    expect(logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
    expect(calls).toEqual(["logout", ["/login", { replace: true }]]);
  });
});
