export const CONTENT_TYPES = {
  research: {
    key: "research",
    api: "research",
    singular: "Research Note",
    plural: "Research Library",
    detailRoute: (id) => `/research/${id}`,
    listRoute: "/research",
  },
  education: {
    key: "education",
    api: "education",
    singular: "Education Module",
    plural: "Investment Education",
    detailRoute: (id) => `/education/${id}`,
    listRoute: "/education",
  },
  reports: {
    key: "reports",
    api: "reports",
    singular: "Monthly Report",
    plural: "Monthly Reports",
    detailRoute: (id) => `/reports/${id}`,
    listRoute: "/reports",
  },
  companies: {
    key: "companies",
    api: "companies",
    singular: "Company",
    plural: "Company Analysis",
    detailRoute: (id) => `/companies/${id}`,
    listRoute: "/companies",
  },
};

export const RESEARCH_CATEGORIES = [
  "Macro",
  "Equities",
  "Fixed Income",
  "Alternatives",
  "Sector",
  "Commodities",
];

export const COMPANY_SECTORS = [
  "Financials",
  "Industrials",
  "Consumer",
  "Technology",
  "Energy",
  "Healthcare",
  "Materials",
  "Utilities",
  "Real Estate",
  "Communications",
];

export const COMPANY_STATUSES = ["covered", "watching", "exited"];

export const EDUCATION_TRACKS = [
  "Foundations",
  "Macro & Capital Cycles",
  "Portfolio Construction",
  "Behavioural Discipline",
  "Advanced Practice",
];

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
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
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}
