import React from "react";

export const Panel = ({ overline, title, action, children, className = "", testid }) => {
  return (
    <section
      data-testid={testid}
      className={`bg-[var(--hc-surface)] border border-[var(--hc-border)] ${className}`}
    >
      {(overline || title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--hc-border)]">
          <div className="min-w-0">
            {overline && <div className="hc-overline mb-1">{overline}</div>}
            {title && (
              <h3 className="text-sm sm:text-base font-medium tracking-tight text-[var(--hc-text)] truncate">
                {title}
              </h3>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
};
