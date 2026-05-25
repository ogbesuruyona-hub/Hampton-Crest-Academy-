import React from "react";

const VARIANTS = {
  published: {
    label: "Publicado",
    cls: "border-[var(--hc-gold)]/50 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]",
  },
  draft: {
    label: "Borrador",
    cls: "border-[var(--hc-border)] text-[var(--hc-text-muted)] bg-transparent",
  },
  covered: {
    label: "Cubierta",
    cls: "border-[var(--hc-gold)]/40 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]",
  },
  watching: {
    label: "En observación",
    cls: "border-[var(--hc-border)] text-[var(--hc-platinum)] bg-[var(--hc-surface-elevated)]",
  },
  exited: {
    label: "Salida",
    cls: "border-[var(--hc-border)] text-[var(--hc-text-muted)] bg-transparent",
  },
};

export const StatusBadge = ({ status, testid }) => {
  const v = VARIANTS[status] || VARIANTS.draft;
  return (
    <span
      data-testid={testid || `status-badge-${status}`}
      className={`inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border ${v.cls}`}
    >
      {v.label}
    </span>
  );
};
