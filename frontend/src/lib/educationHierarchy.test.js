import { describe, expect, it } from "vitest";
import { buildEducationModules, findLessonModule, moduleTitleFromLesson } from "./educationHierarchy";

describe("education hierarchy", () => {
  it("derives a legacy module title without changing the lesson title", () => {
    const lesson = { id: "lesson-1", title: "Capítulo 1 Valoración de empresas", order_index: 0 };
    const [module] = buildEducationModules([lesson]);

    expect(module.title).toBe("Valoración de empresas");
    expect(module.lessons[0].title).toBe("Capítulo 1 Valoración de empresas");
  });

  it("uses explicit module metadata when it exists", () => {
    const modules = buildEducationModules([
      { id: "b", title: "Lección 2", module_id: "m1", module_title: "Estados financieros", module_order: 1, order_index: 101 },
      { id: "a", title: "Lección 1", module_id: "m1", module_title: "Estados financieros", module_order: 1, order_index: 100 },
    ]);

    expect(modules[0].title).toBe("Estados financieros");
    expect(modules[0].lessons.map((lesson) => lesson.id)).toEqual(["a", "b"]);
  });

  it("finds the module containing the next lesson", () => {
    const context = findLessonModule([{ id: "fundamentos", lessons: [{ id: "next", title: "Capítulo 1 Riesgo" }] }], "next");
    expect(context.moduleNumber).toBe(1);
    expect(context.module.title).toBe("Riesgo");
  });

  it("removes only a leading chapter or lesson marker", () => {
    expect(moduleTitleFromLesson("Capítulo 12 — Ciclos de capital")).toBe("Ciclos de capital");
    expect(moduleTitleFromLesson("Valoración por capítulo")).toBe("Valoración por capítulo");
  });
});
