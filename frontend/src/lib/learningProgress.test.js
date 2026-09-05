import { describe, expect, it } from "vitest";
import { courseIdFromTrack } from "./learningProgress";

describe("courseIdFromTrack", () => {
  it("creates stable course identifiers from the existing Spanish tracks", () => {
    expect(courseIdFromTrack("Fundamentos")).toBe("fundamentos");
    expect(courseIdFromTrack("Construcción de Cartera")).toBe("construccion-de-cartera");
  });

  it("maps the legacy Foundations label without losing progress", () => {
    expect(courseIdFromTrack("Foundations")).toBe("fundamentos");
  });
});

