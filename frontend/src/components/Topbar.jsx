import React from "react";
import { Search, Bell, Menu, LogOut, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const initials = (name = "") =>
  name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "HC";

export const Topbar = ({ onOpenMobileSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = React.useState("");

  const submitSearch = (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 h-16 border-b border-[var(--hc-border)] bg-[var(--hc-bg)]/85 backdrop-blur-md"
    >
      <div className="h-full flex items-center gap-4 px-4 sm:px-8">
        <button
          className="lg:hidden p-2 -ml-2 text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation"
          data-testid="mobile-menu-button"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* Search */}
        <form onSubmit={submitSearch} className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]" strokeWidth={1.5} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar investigación, reportes, empresas…"
              data-testid="topbar-search"
              className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] placeholder:text-[var(--hc-text-muted)] pl-9 pr-3 py-2 focus:outline-none focus:border-[var(--hc-gold)] transition-colors"
            />
          </div>
        </form>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <button
            className="hidden sm:flex items-center justify-center h-9 w-9 text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)] transition-colors"
            aria-label="Notifications"
            data-testid="topbar-notifications"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="profile-menu-trigger"
                className="flex items-center gap-3 pl-2 pr-3 py-1.5 hover:bg-[var(--hc-surface)] transition-colors"
              >
                <div className="h-8 w-8 flex items-center justify-center bg-[var(--hc-surface-elevated)] border border-[var(--hc-border)] text-xs tracking-wider text-[var(--hc-platinum)]">
                  {initials(user?.name)}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs text-[var(--hc-text)] tracking-tight">{user?.name || "Miembro"}</span>
                  <span className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--hc-text-muted)]">
                    {user?.role === "admin" ? "administrador" : "miembro"}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[var(--hc-surface-elevated)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none min-w-[200px]"
            >
              <DropdownMenuLabel className="text-[var(--hc-text-muted)] uppercase text-[0.65rem] tracking-[0.18em]">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--hc-border)]" />
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                data-testid="profile-menu-item"
                className="focus:bg-[var(--hc-surface-hover)] focus:text-[var(--hc-text)] cursor-pointer"
              >
                <UserIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/settings")}
                className="focus:bg-[var(--hc-surface-hover)] focus:text-[var(--hc-text)] cursor-pointer"
              >
                Ajustes
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--hc-border)]" />
              <DropdownMenuItem
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                data-testid="logout-menu-item"
                className="focus:bg-[var(--hc-surface-hover)] focus:text-[var(--hc-text)] cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
