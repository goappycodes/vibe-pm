"use client";

import { cn } from "@/lib/utils";
import {
  CalendarCheck2,
  GanttChartSquare,
  KanbanSquare,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const VIEWS = [
  { href: "/my-day", label: "My Day", icon: CalendarCheck2 },
  { href: "/table", label: "Table", icon: Table2 },
  { href: "/board", label: "Board", icon: KanbanSquare },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
];

export function ViewSwitcher() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5">
      {VIEWS.map((v) => {
        const active = pathname === v.href;
        const Icon = v.icon;
        return (
          <Link
            key={v.href}
            href={v.href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
              active
                ? "bg-surface text-fg shadow-soft"
                : "text-muted hover:text-fg"
            )}
            title={v.label}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{v.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
