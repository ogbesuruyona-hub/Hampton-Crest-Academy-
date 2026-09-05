import { api } from "./api";

const STORAGE_KEY = "hc_completed_lessons";

export const COURSE_CATALOG = [
  { id: "fundamentos", title: "Fundamentos", position: 0 },
  { id: "macro-y-ciclos-de-capital", title: "Macro y Ciclos de Capital", position: 1 },
  { id: "construccion-de-cartera", title: "Construcción de Cartera", position: 2 },
  { id: "disciplina-conductual", title: "Disciplina Conductual", position: 3 },
  { id: "practica-avanzada", title: "Práctica Avanzada", position: 4 },
];

export const courseIdFromTrack = (value = "") => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug === "foundations" ? "fundamentos" : slug || "ruta-general";
};

const readSet = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const writeSet = (set) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
};

export const learningProgress = {
  getCompletedIds() {
    return readSet();
  },
  isCompleted(id) {
    if (!id) return false;
    return readSet().has(id);
  },
  setCompleted(id, completed = true) {
    if (!id) return;
    const set = readSet();
    if (completed) set.add(id);
    else set.delete(id);
    writeSet(set);
  },
  getPercent(lessons) {
    if (!Array.isArray(lessons) || lessons.length === 0) return 0;
    const set = readSet();
    const completed = lessons.filter((lesson) => set.has(lesson.id)).length;
    return Math.round((completed / lessons.length) * 100);
  },
  async syncWithServer() {
    const lessonIds = [...readSet()];
    const { data } = lessonIds.length
      ? await api.post("/progress/lessons/sync", { lesson_ids: lessonIds })
      : await api.get("/progress/courses");
    const serverIds = new Set(
      (Array.isArray(data) ? data : []).flatMap((course) => course.completed_lesson_ids || []),
    );
    writeSet(serverIds);
    return Array.isArray(data) ? data : [];
  },
  async setCompletedOnServer(id, completed = true) {
    const { data } = await api.post(`/progress/lessons/${id}`, { completed });
    this.setCompleted(id, completed);
    return data;
  },
};
