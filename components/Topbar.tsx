"use client";

import { useStore } from "@/lib/store";
import { PROJECT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { MenuItem, Popover } from "./Popover";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/my-day": { title: "My Day", subtitle: "Your tasks, by urgency and due date" },
  "/table": { title: "Table", subtitle: "Dense grid — inline & bulk edit" },
  "/board": { title: "Board", subtitle: "Kanban by status" },
  "/timeline": { title: "Timeline", subtitle: "Due dates & dependencies" },
};

export function Topbar() {
  const pathname = usePathname();
  const meta = TITLES[pathname] ?? { title: "Vibe PM", subtitle: "" };
  const projects = useStore((s) => s.projects);
  const activeProject = useStore((s) => s.activeProject);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const addTask = useStore((s) => s.addTask);
  const openDetail = useStore((s) => s.openDetail);

  const showProjectFilter = pathname !== "/my-day";
  const active = projects.find((p) => p.id === activeProject);

  const handleNew = () => {
    const id = addTask({ title: "Untitled task" });
    openDetail(id);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/80 px-5 backdrop-blur">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold leading-none text-fg">
          {meta.title}
        </h1>
        <p className="mt-1 truncate text-xs text-faint">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        {showProjectFilter && (
          <Popover
            width={220}
            align="end"
            trigger={({ toggle }) => (
              <button onClick={toggle} className="btn-outline gap-1.5">
                {active ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        (PROJECT_COLORS[active.color] ?? PROJECT_COLORS.indigo)
                          .dot
                      )}
                    />
                    {active.name}
                  </span>
                ) : (
                  "All projects"
                )}
                <ChevronDown className="h-3.5 w-3.5 text-faint" />
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-72 overflow-y-auto py-1">
                <MenuItem
                  active={activeProject === "all"}
                  onClick={() => {
                    setActiveProject("all");
                    close();
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-faint" />
                  <span className="flex-1">All projects</span>
                  {activeProject === "all" && (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  )}
                </MenuItem>
                {projects.map((p) => (
                  <MenuItem
                    key={p.id}
                    active={activeProject === p.id}
                    onClick={() => {
                      setActiveProject(p.id);
                      close();
                    }}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        (PROJECT_COLORS[p.color] ?? PROJECT_COLORS.indigo).dot
                      )}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    {activeProject === p.id && (
                      <Check className="h-3.5 w-3.5 text-accent" />
                    )}
                  </MenuItem>
                ))}
              </div>
            )}
          </Popover>
        )}

        <button
          onClick={() => setCommandOpen(true)}
          className="btn-outline gap-2 text-muted"
          title="Search (Cmd K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </button>

        <button onClick={handleNew} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          New task
        </button>
      </div>
    </header>
  );
}
