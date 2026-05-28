import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { DesktopSidebar, SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Sheet, SheetContent } from "./ui/sheet";
import ChatWidget from "./ChatWidget";

export const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)]">
      <DesktopSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[280px] bg-[var(--hc-surface)] border-r border-[var(--hc-border)] text-[var(--hc-text)]"
          data-testid="mobile-sidebar"
        >
          <SidebarContent onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div
        className={`flex flex-col min-h-screen transition-[padding] duration-300 ${
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        }`}
      >
        <Topbar onOpenMobileSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 sm:px-8 py-8 lg:py-10 hc-noise" data-testid="page-main">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatWidget />
    </div>
  );
};
