import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  BookOpen,
  GraduationCap,
  FileText,
  BarChart3,
  Bookmark,
  Settings as SettingsIcon,
  Users,
  UserCircle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Panel", icon: LayoutGrid, testid: "nav-dashboard" },
  { to: "/research", label: "Biblioteca", icon: BookOpen, testid: "nav-research" },
  { to: "/education", label: "Educación", icon: GraduationCap, testid: "nav-education" },
  { to: "/reports", label: "Reportes Mensuales", icon: FileText, testid: "nav-reports" },
  { to: "/companies", label: "Análisis de Empresas", icon: BarChart3, testid: "nav-companies" },
  { to: "/directory", label: "Directorio de Miembros", icon: UserCircle, testid: "nav-directory" },
  { to: "/saved", label: "Guardados", icon: Bookmark, testid: "nav-saved" },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon, testid: "nav-settings" },
];

const ADMIN_NAV = [
  { to: "/admin/members", label: "Miembros", icon: Users, testid: "nav-admin-members" },
];

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

export const SidebarContent = ({ collapsed = false, onItemClick }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <div className="flex flex-col h-full" data-testid="sidebar-content">
      {/* Brand */}
      <div
        className={`flex items-center gap-3 ${
          collapsed ? "justify-center px-2" : "px-6"
        } py-6 border-b border-[var(--hc-border)]`}
      >
        <img
          src={LOGO_URL}
          alt="Hampton Crest Academy"
          data-testid="sidebar-logo"
          className="h-11 w-11 object-contain shrink-0"
          style={{ mixBlendMode: "screen" }}
        />
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-[0.7rem] tracking-[0.22em] text-[var(--hc-gold)] uppercase font-semibold">
              Hampton Crest
            </span>
            <span className="text-[0.65rem] tracking-[0.32em] text-[var(--hc-text-muted)] uppercase">
              Academy
            </span>
          </div>
        )}
      </div>

      {/* Section label */}
      {!collapsed && (
        <div className="px-6 pt-6 pb-3">
          <span className="hc-overline">Academia</span>
        </div>
      )}
      {collapsed && <div className="h-6" />}

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2" data-testid="sidebar-nav">
        {NAV.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onItemClick}
            data-testid={testid}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 ${
                collapsed ? "justify-center px-2" : "px-4"
              } py-2.5 text-sm transition-colors ${
                isActive
                  ? "text-[var(--hc-text)] bg-[var(--hc-surface-elevated)]"
                  : "text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1 bottom-1 w-[2px] transition-colors ${
                    isActive ? "bg-[var(--hc-gold)]" : "bg-transparent"
                  }`}
                />
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                {!collapsed && <span className="truncate tracking-tight">{label}</span>}
              </>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className={`${collapsed ? "mx-2" : "mx-4"} mt-6 mb-2`}>
              {!collapsed && <div className="hc-overline">Administración</div>}
              {collapsed && <div className="h-px bg-[var(--hc-border)]" />}
            </div>
            {ADMIN_NAV.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onItemClick}
                data-testid={testid}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 ${
                    collapsed ? "justify-center px-2" : "px-4"
                  } py-2.5 text-sm transition-colors ${
                    isActive
                      ? "text-[var(--hc-text)] bg-[var(--hc-surface-elevated)]"
                      : "text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute left-0 top-1 bottom-1 w-[2px] transition-colors ${
                        isActive ? "bg-[var(--hc-gold)]" : "bg-transparent"
                      }`}
                    />
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                    {!collapsed && <span className="truncate tracking-tight">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="px-6 py-5 border-t border-[var(--hc-border)]">
          <div className="hc-overline mb-1">Estado</div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--hc-gold)]" />
            <span className="text-xs text-[var(--hc-text-secondary)] tracking-tight">
              Miembro fundador
            </span>
          </div>
        </div>
      ) : (
        <div className="py-5 flex justify-center border-t border-[var(--hc-border)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hc-gold)]" />
        </div>
      )}
    </div>
  );
};

export const DesktopSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside
      data-testid="desktop-sidebar"
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 border-r border-[var(--hc-border)] bg-[var(--hc-surface)] transition-[width] duration-300 ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      <SidebarContent collapsed={collapsed} />
      <button
        onClick={onToggle}
        data-testid="sidebar-collapse-toggle"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-20 h-6 w-6 flex items-center justify-center bg-[var(--hc-surface-elevated)] border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
      >
        {collapsed ? (
          <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : (
          <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
      </button>
    </aside>
  );
};
