export const classifyRequestError = (error) => {
  const status = Number(error?.response?.status || 0);
  if (status === 401) return { kind: "session", message: "Tu sesión venció. Inicia sesión nuevamente." };
  if (status === 403) return { kind: "forbidden", message: "No tiene permisos para acceder a esta sección." };
  if (status >= 500) return { kind: "server", message: "No pudimos cargar esta información." };
  if (!error?.response) return { kind: "network", message: "No hay conexión con el servidor." };
  return { kind: "error", message: "No pudimos cargar esta información." };
};

export const resolveCollectionState = ({ loading, error, items }) => {
  if (loading) return "loading";
  if (error) return classifyRequestError(error).kind;
  return Array.isArray(items) && items.length === 0 ? "empty" : "ready";
};

export const canAccessRole = (user, requiredRole) => !requiredRole || user?.role === requiredRole;
