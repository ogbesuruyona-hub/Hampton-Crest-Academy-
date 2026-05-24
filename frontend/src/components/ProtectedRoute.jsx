import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-screen flex items-center justify-center bg-[var(--hc-bg)]"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-1 h-1 bg-[var(--hc-gold)] rounded-full animate-pulse" />
          <div className="hc-overline">Authenticating</div>
        </div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
