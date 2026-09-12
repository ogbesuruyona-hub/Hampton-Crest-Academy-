import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BrandHomeLink } from "./Sidebar";

describe("sidebar brand", () => {
  it("keeps the complete logo as a dashboard link", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <BrandHomeLink />
      </MemoryRouter>,
    );

    expect(markup).toContain('href="/dashboard"');
    expect(markup).toContain('data-testid="sidebar-home-link"');
    expect(markup).toContain('data-testid="sidebar-logo"');
    expect(markup).toContain("Ir al inicio de Hampton Crest Academy");
  });
});
