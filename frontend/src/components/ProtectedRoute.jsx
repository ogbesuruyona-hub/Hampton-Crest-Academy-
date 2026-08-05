import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
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

  return children;
};
