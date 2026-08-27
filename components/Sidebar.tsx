"use client";

import { useStore } from "@/lib/store";
import { authRequired, supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarCheck2,
  Folder,
  GanttChartSquare,
  Gauge,
  KanbanSquare,
  LogOut,
  MessageSquare,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Table2,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

const NAV = [
  { href: "/my-day", label: "My Day", icon: CalendarCheck2 },
  { href: "/table", label: "Table", icon: Table2 },
  { href: "/board", label: "Board", icon: KanbanSquare },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { href: "/updates", label: "Updates", icon: MessageSquare },
];

const MANAGE = [
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/team", label: "Team", icon: Users2 },
  { href: "/velocity", label: "Velocity", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  theme,
  toggleTheme,
  open = false,
  onClose,
}: {
  theme: "light" | "dark";
  toggleTheme: () => void;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 md:hidden",
          open ? "block" : "hidden"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-fg">Vibe PM</div>
          <div className="text-[11px] text-faint">Appycodes</div>
        </div>
      </div>

      <nav className="px-2 pt-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="border-t border-border px-2 py-2">
        <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Manage
        </div>
        {MANAGE.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/team" && pathname.startsWith("/member")) ||
            (item.href === "/projects" && pathname.startsWith("/project/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <Avatar member={currentUser} size="md" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-fg">
              {currentUser?.name}
            </div>
            <div className="truncate text-[11px] capitalize text-faint">
              {currentUser?.role.replace("_", " ")}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="btn-ghost h-8 w-8 p-0"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          {authRequired && (
            <button
              onClick={() => supabase?.auth.signOut()}
              className="btn-ghost h-8 w-8 p-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
