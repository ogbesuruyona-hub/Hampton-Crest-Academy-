import React from "react";

export const PageHeader = ({ overline, title, description, actions, testid }) => {
  return (
    <div data-testid={testid || "page-header"} className="mb-10 hc-enter">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="max-w-3xl">
          {overline && <div className="hc-overline mb-3">{overline}</div>}
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-medium tracking-[-0.02em] text-[var(--hc-text)] leading-[1.1]">
            {title}
          </h1>
          {description && (
            <p className="mt-4 text-[var(--hc-text-secondary)] tracking-tight text-sm sm:text-base max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="mt-8 hc-gold-rule" />
    </div>
  );
};
