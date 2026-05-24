import React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const AdminAction = ({ onClick, icon: Icon = Plus, label, testid, variant = "primary" }) => {
  const cls =
    variant === "primary"
      ? "bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white"
      : "border border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] bg-transparent";
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`flex items-center gap-2 px-4 py-2 text-xs tracking-[0.18em] uppercase transition-colors ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
    </button>
  );
};

export const AdminInlineActions = ({ onEdit, onDelete, testid }) => (
  <div className="flex gap-2" data-testid={testid}>
    <button
      onClick={onEdit}
      className="flex items-center gap-1.5 px-3 py-2 text-[0.7rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
      data-testid="admin-edit"
    >
      <Pencil className="h-3 w-3" strokeWidth={1.5} /> Edit
    </button>
    <button
      onClick={onDelete}
      className="flex items-center gap-1.5 px-3 py-2 text-[0.7rem] tracking-[0.18em] uppercase border border-[#7A2424] text-[#E07A7A] hover:bg-[#2A0F0F] transition-colors"
      data-testid="admin-delete"
    >
      <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Delete
    </button>
  </div>
);
