import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { classifyRequestError } from "../lib/requestState";

export function RequestError({ error, onRetry, compact = false }) {
  const state = classifyRequestError(error);
  return (
    <div role="alert" data-testid={`request-error-${state.kind}`} className={`border border-[#a74444]/35 bg-[#f8e9e7] text-[#713535] ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{state.message}</p>
          {onRetry && !["forbidden", "session"].includes(state.kind) ? (
            <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 border border-[#713535]/30 px-4 text-xs uppercase tracking-[0.14em]">
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
