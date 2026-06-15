import React from "react";

export const EmptyState = ({ icon: Icon, title, description, action, testid, overline = "Sin contenido disponible" }) => {
  return (
    <div
      data-testid={testid || "empty-state"}
      className="flex flex-col items-center justify-center text-center px-6 sm:px-8 py-14 sm:py-20 border border-dashed border-[var(--hc-border)] bg-[var(--hc-surface)]/40"
    >
      {Icon && (
        <div className="h-14 w-14 flex items-center justify-center border border-[var(--hc-border)] bg-[var(--hc-bg)] mb-6">
          <Icon className="h-6 w-6 text-[var(--hc-text-muted)]" strokeWidth={1.25} />
        </div>
      )}
      <div className="hc-overline mb-2 text-[var(--hc-gold)]/80">{overline}</div>
      <h3 className="text-lg sm:text-xl font-medium text-[var(--hc-text)] tracking-tight">{title}</h3>
      {description && (
        <p className="mt-3 text-sm text-[var(--hc-text-secondary)] max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};
