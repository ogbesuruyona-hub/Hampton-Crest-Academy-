const STORAGE_KEY = "hc_completed_lessons";

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
};
