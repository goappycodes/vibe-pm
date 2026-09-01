"use client";

import { useStore } from "@/lib/store";
import { STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarCheck2,
  CornerDownLeft,
  Folder,
  GanttChartSquare,
  Gauge,
  KanbanSquare,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Square,
  Table2,
  Timer,
  UserPlus,
  Users2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useStore((s) => s.commandOpen);
  const setOpen = useStore((s) => s.setCommandOpen);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.members);
  const openDetail = useStore((s) => s.openDetail);
  const addTask = useStore((s) => s.addTask);
  const addProject = useStore((s) => s.addProject);
  const addMember = useStore((s) => s.addMember);
  const runningTimer = useStore((s) => s.runningTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo<CmdItem[]>(() => {
    const nav: CmdItem[] = [
      {
        id: "nav-my-day",
        label: "Go to My Day",
        icon: <CalendarCheck2 className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/my-day"),
      },
      {
        id: "nav-table",
        label: "Go to Table",
        icon: <Table2 className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/table"),
      },
      {
        id: "nav-board",
        label: "Go to Board",
        icon: <KanbanSquare className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/board"),
      },
      {
        id: "nav-timeline",
        label: "Go to Timeline",
        icon: <GanttChartSquare className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/timeline"),
      },
      {
        id: "nav-time-log",
        label: "Go to Time Log",
        hint: "Log hours",
        icon: <Timer className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/time-log"),
      },
      {
        id: "nav-updates",
        label: "Go to Updates",
        icon: <MessageSquare className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/updates"),
      },
      {
        id: "nav-projects",
        label: "Go to Projects",
        icon: <Folder className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/projects"),
      },
      {
        id: "nav-clients",
        label: "Go to Clients",
        icon: <Building2 className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/clients"),
      },
      {
        id: "nav-team",
        label: "Go to Team",
        icon: <Users2 className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/team"),
      },
      {
        id: "nav-velocity",
        label: "Go to Velocity",
        icon: <Gauge className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/velocity"),
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        icon: <Settings className="h-4 w-4" />,
        group: "Navigate",
        run: () => router.push("/settings"),
      },
      ...(runningTimer
        ? [
            {
              id: "stop-timer",
              label: "Stop timer",
              hint: "log this time",
              icon: <Square className="h-3.5 w-3.5" />,
              group: "Actions",
              run: () => stopTimer(),
            } as CmdItem,
          ]
        : []),
      {
        id: "new-task",
        label: "Create new task",
        icon: <Plus className="h-4 w-4" />,
        group: "Actions",
        run: () => {
          const id = addTask({ title: "Untitled task" });
          openDetail(id);
        },
      },
      {
        id: "new-project",
        label: "Create project",
        icon: <Folder className="h-4 w-4" />,
        group: "Actions",
        // Opens the details dialog on the projects page.
        run: () => router.push("/projects?new=1"),
      },
      {
        id: "new-member",
        label: "Create team member",
        icon: <UserPlus className="h-4 w-4" />,
        group: "Actions",
        run: () => {
          addMember();
          router.push("/team");
        },
      },
    ];

    const q = query.trim().toLowerCase();
    const taskItems: CmdItem[] = q
      ? tasks
          .filter((t) => t.title.toLowerCase().includes(q))
          .slice(0, 6)
          .map((t) => {
            const project = projects.find((p) => p.id === t.project_id);
            return {
              id: `task-${t.id}`,
              label: t.title,
              hint: project?.name,
              icon: (
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    STATUS_META[t.status].dot
                  )}
                />
              ),
              group: "Tasks",
              run: () => openDetail(t.id),
            };
          })
      : [];

    const projectItems: CmdItem[] = q
      ? projects
          .filter((p) => p.name.toLowerCase().includes(q))
          .slice(0, 5)
          .map((p) => ({
            id: `project-${p.id}`,
            label: p.name,
            hint: p.slack_channel_id ? `#${p.slack_channel_id}` : undefined,
            icon: <Folder className="h-4 w-4" />,
            group: "Projects",
            run: () => router.push(`/project/${p.id}`),
          }))
      : [];

    const memberItems: CmdItem[] = q
      ? members
          .filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q)
          )
          .slice(0, 5)
          .map((m) => ({
            id: `member-${m.id}`,
            label: m.name,
            hint: m.email,
            icon: <Users2 className="h-4 w-4" />,
            group: "People",
            run: () => router.push(`/member/${m.id}`),
          }))
      : [];

    const navFiltered = q
      ? nav.filter((n) => n.label.toLowerCase().includes(q))
      : nav;

    return [...navFiltered, ...taskItems, ...projectItems, ...memberItems];
  }, [
    query,
    tasks,
    projects,
    members,
    router,
    addTask,
    addProject,
    addMember,
    openDetail,
    runningTimer,
    stopTimer,
  ]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const close = () => setOpen(false);
  const runItem = (item: CmdItem) => {
    item.run();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) runItem(items[active]);
    } else if (e.key === "Escape") {
      close();
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || !mounted) return null;

  let lastGroup = "";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-pop animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks or jump to…"
            className="w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-faint"
          />
          <span className="kbd">esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-faint">
              No matches
            </div>
          )}
          {items.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {showGroup && (
                  <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                    {item.group}
                  </div>
                )}
                <button
                  data-idx={idx}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => runItem(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left text-sm",
                    active === idx ? "bg-surface-2" : ""
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-muted">
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate text-fg">{item.label}</span>
                  {item.hint && (
                    <span className="text-xs text-faint">{item.hint}</span>
                  )}
                  {active === idx && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-faint" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
