export const CONTENT_TYPES = {
  research: {
    key: "research",
    api: "research",
    singular: "Nota de investigación",
    plural: "Investigación",
    detailRoute: (id) => `/research/${id}`,
    listRoute: "/research",
  },
  education: {
    key: "education",
    api: "education",
    singular: "Módulo",
    plural: "Educación",
    detailRoute: (id) => `/education/${id}`,
    listRoute: "/education",
  },
  reports: {
    key: "reports",
    api: "reports",
    singular: "Reporte mensual",
    plural: "Reportes Mensuales",
    detailRoute: (id) => `/reports/${id}`,
    listRoute: "/reports",
  },
  companies: {
    key: "companies",
    api: "companies",
    singular: "Empresa",
    plural: "Análisis de Empresas",
    detailRoute: (id) => `/companies/${id}`,
    listRoute: "/companies",
  },
  books: {
    key: "books",
    api: "books",
    singular: "Libro",
    plural: "Biblioteca",
    detailRoute: () => "/research",
    listRoute: "/research",
    external: true,
  },
};

export const RESEARCH_CATEGORIES = [
  "Macro",
  "Acciones",
  "Renta Fija",
  "Alternativos",
  "Sectorial",
  "Materias Primas",
];

export const LIBRARY_CATEGORIES = [
  "Clásicos de inversión",
  "Value Investing",
  "Macro y Ciclos",
  "Finanzas Conductuales",
  "Historia de los Mercados",
  "Estrategia y Modelos Mentales",
  "Fundadores y Operadores",
];

export const COMPANY_SECTORS = [
  "Financiero",
  "Industrial",
  "Consumo",
  "Tecnología",
  "Energía",
  "Salud",
  "Materiales",
  "Servicios Públicos",
  "Bienes Raíces",
  "Comunicaciones",
];

export const COMPANY_STATUSES = ["covered", "watching", "exited"];

export const EDUCATION_TRACKS = [
  "Fundamentos",
  "Macro y Ciclos de Capital",
  "Construcción de Cartera",
  "Disciplina Conductual",
  "Práctica Avanzada",
];

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatPeriod(period) {
  if (!period) return "—";
  const [y, m] = period.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "long" });
}
