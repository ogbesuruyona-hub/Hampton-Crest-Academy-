import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { courseIdFromTrack, learningProgress } from "./learningProgress";

vi.mock("./api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const storage = new Map();

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
});

describe("courseIdFromTrack", () => {
  it("creates stable course identifiers from the existing Spanish tracks", () => {
    expect(courseIdFromTrack("Fundamentos")).toBe("fundamentos");
    expect(courseIdFromTrack("Construcción de Cartera")).toBe("construccion-de-cartera");
  });

  it("maps the legacy Foundations label without losing progress", () => {
    expect(courseIdFromTrack("Foundations")).toBe("fundamentos");
  });

  it("keeps browser progress isolated by authenticated user", () => {
    storage.set("hc_completed_lessons", JSON.stringify(["legacy-lesson"]));
    learningProgress.setCompleted("lesson-a", true, "user-a");

    expect([...learningProgress.getCompletedIds("user-a")]).toEqual(["lesson-a"]);
    expect([...learningProgress.getCompletedIds("user-b")]).toEqual([]);
    expect(learningProgress.isCompleted("legacy-lesson", "user-b")).toBe(false);
  });

  it("treats the server as progress authority during synchronization", async () => {
    learningProgress.setCompleted("stale-local", true, "user-a");
    api.get.mockResolvedValue({
      data: [{ course: { id: "fundamentos" }, completed_lesson_ids: ["server-lesson"] }],
    });

    await learningProgress.syncWithServer("user-a");

    expect(api.get).toHaveBeenCalledWith("/progress/courses");
    expect(api.post).not.toHaveBeenCalled();
    expect([...learningProgress.getCompletedIds("user-a")]).toEqual(["server-lesson"]);
  });
});
