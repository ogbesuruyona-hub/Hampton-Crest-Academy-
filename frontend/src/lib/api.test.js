import { describe, expect, it } from "vitest";
import { formatApiErrorDetail } from "./api";

describe("formatApiErrorDetail", () => {
  it("normaliza errores de validación sin perder sus mensajes", () => {
    expect(formatApiErrorDetail([{ msg: "Correo inválido" }, { msg: "Contraseña corta" }]))
      .toBe("Correo inválido Contraseña corta");
  });

  it("usa un mensaje seguro cuando el detalle no existe", () => {
    expect(formatApiErrorDetail(null)).toContain("Inténtalo de nuevo");
  });
});
