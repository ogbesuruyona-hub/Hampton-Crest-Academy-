const lessonOrder = (lesson) => {
  const value = Number(lesson?.order_index);
  return Number.isFinite(value) ? value : 9999;
};

export const moduleTitleFromLesson = (title = "") => {
  const withoutPrefix = title.replace(/^\s*(?:cap[ií]tulo|lecci[oó]n)\s+\d+\s*(?:[-—:·]\s*)?/i, "").trim();
  return withoutPrefix || title.trim() || "Contenido del módulo";
};

export const buildEducationModules = (lessons = []) => {
  const grouped = lessons.reduce((result, lesson) => {
    const id = lesson.module_id || "legacy-module";
    if (!result[id]) {
      result[id] = {
        id,
        title: lesson.module_title || "",
        order: Number(lesson.module_order) || 0,
        firstLessonOrder: lessonOrder(lesson),
        lessons: [],
      };
    }
    result[id].lessons.push(lesson);
    result[id].firstLessonOrder = Math.min(result[id].firstLessonOrder, lessonOrder(lesson));
    if (!result[id].title && lesson.module_title) result[id].title = lesson.module_title;
    return result;
  }, {});

  return Object.values(grouped)
    .map((module) => {
      const orderedLessons = [...module.lessons].sort((a, b) => lessonOrder(a) - lessonOrder(b));
      return {
        ...module,
        title: module.title || moduleTitleFromLesson(orderedLessons[0]?.title),
        lessons: orderedLessons,
      };
    })
    .sort((a, b) => a.order - b.order || a.firstLessonOrder - b.firstLessonOrder);
};

export const findLessonModule = (courses = [], lessonId) => {
  for (const course of courses) {
    const modules = buildEducationModules(course.lessons);
    const moduleIndex = modules.findIndex((module) => module.lessons.some((lesson) => lesson.id === lessonId));
    if (moduleIndex >= 0) return { course, module: modules[moduleIndex], moduleNumber: moduleIndex + 1 };
  }
  return null;
};
