import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessRole } from "../lib/requestState";

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-screen flex items-center justify-center bg-[var(--hc-bg)]"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-1 h-1 bg-[var(--hc-gold)] rounded-full animate-pulse" />
          <div className="hc-overline">Autenticando</div>
        </div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  if (user.has_access === false) {
    return <Navigate to="/access-denied" replace />;
  }

  if (user.requires_2fa_setup && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace state={{ securitySetupRequired: true }} />;
  }

  if (!canAccessRole(user, requiredRole)) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4" data-testid="admin-access-denied">
        <div className="max-w-lg border border-[#a74444]/35 bg-[#f8e9e7] p-8 text-center text-[#713535]">
          <h1 className="text-xl font-medium">No tiene permisos para acceder a esta sección</h1>
          <p className="mt-3 text-sm">Esta área está reservada para administradores.</p>
        </div>
      </main>
    );
  }

  return children;
};
