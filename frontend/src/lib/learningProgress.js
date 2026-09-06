import { api } from "./api";

const STORAGE_KEY = "hc_completed_lessons";

const storageKeyForUser = (userId) =>
  userId ? `${STORAGE_KEY}:${String(userId)}` : null;

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

const readSet = (userId) => {
  const storageKey = storageKeyForUser(userId);
  if (!storageKey) return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const writeSet = (userId, set) => {
  const storageKey = storageKeyForUser(userId);
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify([...set]));
};

export const learningProgress = {
  getCompletedIds(userId) {
    return readSet(userId);
  },
  isCompleted(id, userId) {
    if (!id) return false;
    return readSet(userId).has(id);
  },
  setCompleted(id, completed = true, userId) {
    if (!id) return;
    const set = readSet(userId);
    if (completed) set.add(id);
    else set.delete(id);
    writeSet(userId, set);
  },
  getPercent(lessons, userId) {
    if (!Array.isArray(lessons) || lessons.length === 0) return 0;
    const set = readSet(userId);
    const completed = lessons.filter((lesson) => set.has(lesson.id)).length;
    return Math.round((completed / lessons.length) * 100);
  },
  async syncWithServer(userId) {
    const { data } = await api.get("/progress/courses");
    const serverIds = new Set(
      (Array.isArray(data) ? data : []).flatMap((course) => course.completed_lesson_ids || []),
    );
    writeSet(userId, serverIds);
    return Array.isArray(data) ? data : [];
  },
  async setCompletedOnServer(id, completed = true, userId) {
    const { data } = await api.post(`/progress/lessons/${id}`, { completed });
    this.setCompleted(id, completed, userId);
    return data;
  },
};
