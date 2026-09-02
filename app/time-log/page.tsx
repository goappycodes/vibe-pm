"use client";

import { Avatar } from "@/components/Avatar";
import { ProjectBadge } from "@/components/Badges";
import { useStore } from "@/lib/store";
import type { TeamMember, TimeLog } from "@/lib/types";
import {
  addDays,
  cn,
  decimalHours,
  formatClock,
  formatDuration,
  minutesBetween,
  nowClock,
  parseDate,
  today,
  TODAY,
  toISODate,
} from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertTriangle,
  Check,
  Clock3,
  Download,
  Pencil,
  Play,
  Plus,
  Timer,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const sumMinutes = (logs: TimeLog[]) => logs.reduce((a, l) => a + l.minutes, 0);

/** "Today" / "Yesterday" / "Wed, Aug 26" — relative to the real current date. */
function dayLabel(date: string) {
  const today = toISODate(TODAY);
  if (date === today) return "Today";
  if (date === toISODate(addDays(TODAY, -1))) return "Yesterday";
  const d = parseDate(date);
  return d ? format(d, "EEE, MMM d") : date;
}

export default function TimeLogPage() {
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-6">
        <LogBar />
        <MyEntries />
        {isAdmin && <AdminDashboard />}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- entry bar */

const barField =
  "rounded-md border-0 bg-surface px-2 py-1.5 text-sm text-fg outline-none placeholder:text-faint hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-accent/20";

function Divider() {
  return <span className="hidden h-7 w-px shrink-0 bg-border lg:block" />;
}

// Clicking an unfocused field fires focus *and* click; opening the picker once
// per field per interaction keeps the second call from bouncing off the first.
let lastPicker: { el: HTMLInputElement; at: number } | null = null;

/** Time and date fields drop their picker as soon as the field is touched. */
function openPicker(e: React.SyntheticEvent<HTMLInputElement>) {
  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  const now = performance.now();
  if (lastPicker && lastPicker.el === el && now - lastPicker.at < 400) return;
  lastPicker = { el, at: now };
  try {
    el.showPicker?.();
  } catch {
    // Browsers refuse showPicker() without a user gesture (e.g. focus by Tab).
  }
}

interface ComboItem {
  id: string;
  label: string;
  sub?: string;
  starred?: boolean;
}

/** Type-to-filter select: shows the current pick, filters the list as you type. */
function ComboInput({
  value,
  items,
  placeholder,
  emptyLabel,
  className,
  baseClass = barField,
  onPick,
  disabled,
}: {
  value: string;
  items: ComboItem[];
  placeholder: string;
  emptyLabel: string;
  className?: string;
  baseClass?: string;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 });
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          (i.sub?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 12);
  }, [items, query]);

  const reposition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 280);
    setPos({
      top: r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition, matches.length]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        inputRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
      setQuery("");
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, reposition]);

  const pick = (id: string) => {
    onPick(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        value={open ? query : selected?.label ?? ""}
        placeholder={selected?.label ?? placeholder}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            e.stopPropagation();
            pick(matches[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
        }}
        className={cn(
          baseClass,
          "truncate disabled:opacity-40",
          !selected && "text-accent placeholder:text-accent",
          className
        )}
      />
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-pop animate-scale-in"
          >
            {matches.length === 0 ? (
              <div className="px-3 py-2 text-xs text-faint">{emptyLabel}</div>
            ) : (
              matches.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(m.id)}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors",
                    i === active && "bg-surface-2"
                  )}
                >
                  <span className="w-full truncate text-sm text-fg">
                    {m.starred ? "★ " : ""}
                    {m.label}
                  </span>
                  {m.sub && (
                    <span className="w-full truncate text-[11px] text-faint">
                      {m.sub}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Tasks as combo items. Every task is searchable — the chosen project's tasks
 * just sort to the top, so a search that only matches elsewhere still finds it
 * (picking it moves the entry to that project).
 */
function useTaskItems(projectId: string): ComboItem[] {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const currentUserId = useStore((s) => s.currentUserId);
  return useMemo(
    () =>
      [...tasks]
        .sort((a, b) => {
          const thisProject =
            Number(b.project_id === projectId) -
            Number(a.project_id === projectId);
          if (thisProject) return thisProject;
          const mine =
            Number(b.assignee_id === currentUserId) -
            Number(a.assignee_id === currentUserId);
          if (mine) return mine;
          const open =
            Number(a.status === "done") - Number(b.status === "done");
          return open || a.title.localeCompare(b.title);
        })
        .map((t) => ({
          id: t.id,
          label: t.title,
          sub: projects.find((p) => p.id === t.project_id)?.name,
          starred: t.assignee_id === currentUserId,
        })),
    [tasks, projects, projectId, currentUserId]
  );
}

function useProjectItems(): ComboItem[] {
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  return useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        label: p.name,
        sub: clients.find((c) => c.id === p.client_id)?.name,
      })),
    [projects, clients]
  );
}

/** Everything one entry needs: task, project, remark, times, date. */
interface DraftState {
  taskId: string;
  projectId: string;
  remark: string;
  start: string;
  end: string;
  date: string;
}

function useDraft(initial: DraftState) {
  const tasks = useStore((s) => s.tasks);
  const [draft, setDraft] = useState(initial);
  const patch = (p: Partial<DraftState>) => setDraft((d) => ({ ...d, ...p }));

  const pickTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    // Picking a task from another project moves the entry to that project.
    patch({ taskId: id, projectId: task?.project_id ?? draft.projectId });
  };
  const pickProject = (id: string) => {
    const stillFits =
      tasks.find((t) => t.id === draft.taskId)?.project_id === id;
    patch({ projectId: id, taskId: stillFits ? draft.taskId : "" });
  };
  // Keep end from falling behind start — that's the default for a fresh entry.
  const setStart = (v: string) =>
    patch({ start: v, ...(!draft.end || draft.end < v ? { end: v } : {}) });

  const minutes = minutesBetween(draft.start, draft.end);
  return { draft, patch, pickTask, pickProject, setStart, minutes, setDraft };
}

function DraftFields({
  draft,
  patch,
  pickTask,
  pickProject,
  setStart,
  minutes,
}: ReturnType<typeof useDraft>) {
  const taskItems = useTaskItems(draft.projectId);
  const projectItems = useProjectItems();

  return (
    <>
      <div className="min-w-[180px] flex-1">
        <ComboInput
          value={draft.taskId}
          items={taskItems}
          placeholder="What have you worked on?"
          emptyLabel="No matching task"
          onPick={pickTask}
          className="w-full"
        />
      </div>

      <Divider />

      <ComboInput
        value={draft.projectId}
        items={projectItems}
        placeholder="+ Project"
        emptyLabel="No matching project"
        onPick={pickProject}
        className="w-[150px]"
      />

      <input
        type="text"
        value={draft.remark}
        onChange={(e) => patch({ remark: e.target.value })}
        placeholder="Remark"
        title="Remark (optional)"
        className={cn(barField, "w-[130px]")}
      />

      <Divider />

      <div className="flex items-center gap-0.5">
        <input
          type="time"
          value={draft.start}
          onChange={(e) => setStart(e.target.value)}
          onClick={openPicker}
          onFocus={openPicker}
          className={cn(barField, "w-[120px]")}
          title="Start"
        />
        <span className="text-faint">–</span>
        <input
          type="time"
          value={draft.end}
          onChange={(e) => patch({ end: e.target.value })}
          onClick={openPicker}
          onFocus={openPicker}
          className={cn(barField, "w-[120px]")}
          title="End"
        />
      </div>

      <input
        type="date"
        value={draft.date}
        onChange={(e) => e.target.value && patch({ date: e.target.value })}
        onClick={openPicker}
        onFocus={openPicker}
        className={cn(barField, "w-[128px]")}
        title="Date"
      />

      <Divider />

      <div
        className={cn(
          "min-w-[68px] px-1 text-right text-sm font-semibold tabular-nums",
          minutes === null ? "text-faint" : "text-fg"
        )}
      >
        {minutes === null ? "0m" : formatDuration(minutes)}
      </div>
    </>
  );
}

function LogBar() {
  const currentUserId = useStore((s) => s.currentUserId);
  const timeLogs = useStore((s) => s.timeLogs);
  const addTimeLog = useStore((s) => s.addTimeLog);
  const startTimer = useStore((s) => s.startTimer);
  const runningTimer = useStore((s) => s.runningTimer);
  const [error, setError] = useState<string | null>(null);

  const form = useDraft({
    taskId: "",
    projectId: "",
    remark: "",
    start: nowClock(),
    end: nowClock(),
    date: toISODate(today()),
  });
  const { draft, patch, minutes } = form;

  const overlaps = useMemo(() => {
    if (minutes === null) return false;
    return timeLogs.some(
      (l) =>
        l.user_id === currentUserId &&
        l.date === draft.date &&
        l.start_time < draft.end &&
        draft.start < l.end_time
    );
  }, [timeLogs, currentUserId, draft.date, draft.start, draft.end, minutes]);

  const submit = () => {
    if (!draft.taskId) return setError("Pick a task from the list.");
    if (minutes === null) return setError("End time must be after start time.");
    addTimeLog({
      project_id: draft.projectId || null,
      task_id: draft.taskId,
      date: draft.date,
      start_time: draft.start,
      end_time: draft.end,
      note: draft.remark,
    });
    setError(null);
    // Chain straight into the next stretch of work on the same task.
    patch({ remark: "", start: draft.end, end: draft.end });
  };

  return (
    <div className="mb-5">
      <div
        className="card flex flex-wrap items-center gap-1.5 p-2"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      >
        <DraftFields {...form} />
        <button
          onClick={() => draft.taskId && startTimer(draft.taskId)}
          disabled={!draft.taskId || !!runningTimer}
          className="btn-outline gap-1.5 disabled:opacity-40"
          title={
            runningTimer
              ? "A timer is already running"
              : !draft.taskId
                ? "Pick a task to start a timer"
                : "Start a live timer on this task"
          }
        >
          <Play className="h-4 w-4" />
          Start timer
        </button>
        <button onClick={submit} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {error && <p className="mt-1.5 px-1 text-xs text-rose-600">{error}</p>}
      {!error && overlaps && (
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          This overlaps an entry you already logged on {dayLabel(draft.date)}.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------- my entries, by day */

function MyEntries() {
  const currentUserId = useStore((s) => s.currentUserId);
  const timeLogs = useStore((s) => s.timeLogs);

  const groups = useMemo(() => {
    const byDate = new Map<string, TimeLog[]>();
    timeLogs
      .filter((l) => l.user_id === currentUserId)
      .forEach((l) => byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]));
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, logs]) => ({
        date,
        logs: logs.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }));
  }, [timeLogs, currentUserId]);

  if (groups.length === 0) {
    return (
      <div className="card px-4 py-12 text-center text-sm text-faint">
        Nothing logged yet. Add your first entry above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ date, logs }) => (
        <div key={date} className="card">
          <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-surface-2/60 px-4 py-2">
            <span className="text-sm font-semibold text-fg">
              {dayLabel(date)}
            </span>
            <span className="text-sm font-semibold tabular-nums text-muted">
              {formatDuration(sumMinutes(logs))}
            </span>
          </div>
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <EntryRow key={log.id} log={log} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EntryRow({ log }: { log: TimeLog }) {
  const [editing, setEditing] = useState(false);
  const projectById = useStore((s) => s.projectById);
  const tasks = useStore((s) => s.tasks);
  const removeTimeLog = useStore((s) => s.removeTimeLog);

  if (editing) {
    return <EditRow log={log} onDone={() => setEditing(false)} />;
  }

  const task = tasks.find((t) => t.id === log.task_id);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-fg">
          {task?.title ?? "Deleted task"}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <ProjectBadge project={projectById(log.project_id)} />
          {log.note && (
            <span className="truncate text-[11px] text-faint">{log.note}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-xs tabular-nums text-muted">
        {formatClock(log.start_time)} – {formatClock(log.end_time)}
      </div>
      <div className="w-[72px] shrink-0 text-right text-sm font-semibold tabular-nums text-fg">
        {formatDuration(log.minutes)}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => setEditing(true)}
          className="btn-ghost h-7 w-7 p-0 text-faint hover:text-accent"
          aria-label="Edit entry"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => removeTimeLog(log.id)}
          className="btn-ghost h-7 w-7 p-0 text-faint hover:text-rose-600"
          aria-label="Delete entry"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** The entry bar again, in place of the row, pre-filled with what's saved. */
function EditRow({ log, onDone }: { log: TimeLog; onDone: () => void }) {
  const updateTimeLog = useStore((s) => s.updateTimeLog);
  const [error, setError] = useState<string | null>(null);

  const form = useDraft({
    taskId: log.task_id ?? "",
    projectId: log.project_id ?? "",
    remark: log.note,
    start: log.start_time,
    end: log.end_time,
    date: log.date,
  });
  const { draft, minutes } = form;

  const save = () => {
    if (!draft.taskId) return setError("Pick a task from the list.");
    if (minutes === null) return setError("End time must be after start time.");
    updateTimeLog(log.id, {
      project_id: draft.projectId || null,
      task_id: draft.taskId,
      date: draft.date,
      start_time: draft.start,
      end_time: draft.end,
      note: draft.remark,
    });
    onDone();
  };

  return (
    <div className="bg-surface-2/40 px-3 py-2">
      <div
        className="flex flex-wrap items-center gap-1.5"
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onDone();
        }}
      >
        <DraftFields {...form} />
        <button
          onClick={save}
          className="btn-primary h-8 w-8 p-0"
          aria-label="Save entry"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={onDone}
          className="btn-outline h-8 w-8 p-0"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1.5 px-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/* --------------------------------------------------------- admin dashboard */

function AdminDashboard() {
  const timeLogs = useStore((s) => s.timeLogs);
  const members = useStore((s) => s.members);
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const tasks = useStore((s) => s.tasks);

  const [from, setFrom] = useState(toISODate(addDays(TODAY, -6)));
  const [to, setTo] = useState(toISODate(TODAY));
  const [clientFilter, setClientFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");

  // Every project belongs to one client, so a log inherits its project's.
  const clientOf = useCallback(
    (projectId: string | null) =>
      projects.find((p) => p.id === projectId)?.client_id ?? null,
    [projects]
  );
  // The "who hasn't logged" panel looks at one day, independent of the range.
  const [day, setDay] = useState(toISODate(TODAY));

  const filtered = useMemo(
    () =>
      timeLogs
        .filter((l) => l.date >= from && l.date <= to)
        .filter(
          (l) => clientFilter === "all" || clientOf(l.project_id) === clientFilter
        )
        .filter(
          (l) => projectFilter === "all" || l.project_id === projectFilter
        )
        .filter((l) => memberFilter === "all" || l.user_id === memberFilter)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.start_time.localeCompare(b.start_time)
        ),
    [timeLogs, from, to, clientFilter, clientOf, projectFilter, memberFilter]
  );

  const totalMinutes = sumMinutes(filtered);
  const loggedUserIds = new Set(filtered.map((l) => l.user_id));
  const days = Math.max(1, new Set(filtered.map((l) => l.date)).size);

  const byMember = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((l) =>
      map.set(l.user_id, (map.get(l.user_id) ?? 0) + l.minutes)
    );
    return [...map.entries()]
      .map(([id, minutes]) => ({
        member: members.find((m) => m.id === id),
        minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered, members]);

  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((l) =>
      map.set(
        l.project_id ?? "none",
        (map.get(l.project_id ?? "none") ?? 0) + l.minutes
      )
    );
    return [...map.entries()]
      .map(([id, minutes]) => ({
        project: projects.find((p) => p.id === id),
        minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered, projects]);

  // Who has nothing at all on the chosen day — the nudge list.
  const missing = useMemo(() => {
    const logged = new Set(
      timeLogs.filter((l) => l.date === day).map((l) => l.user_id)
    );
    return members.filter((m) => !logged.has(m.id));
  }, [timeLogs, members, day]);

  const exportCsv = () => {
    const cell = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Date",
      "Member",
      "Email",
      "Client",
      "Project",
      "Task",
      "Start",
      "End",
      "Hours",
      "Duration",
      "Note",
    ];
    const rows = filtered.map((l) => {
      const member = members.find((m) => m.id === l.user_id);
      const project = projects.find((p) => p.id === l.project_id);
      const client = clients.find((c) => c.id === project?.client_id);
      const task = tasks.find((t) => t.id === l.task_id);
      return [
        l.date,
        member?.name ?? "Unknown",
        member?.email ?? "",
        client?.name ?? "—",
        project?.name ?? "—",
        task?.title ?? "—",
        l.start_time,
        l.end_time,
        decimalHours(l.minutes),
        formatDuration(l.minutes),
        l.note,
      ];
    });
    const totals = [
      "Total",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      decimalHours(totalMinutes),
      formatDuration(totalMinutes),
      "",
    ];
    const csv = [header, ...rows, [], totals]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");

    // Byte-order mark so Excel reads it as UTF-8, not the local codepage.
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Name the file after the filters, so per-member exports do not collide.
    const slug = (name?: string) =>
      name ? "_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "";
    a.download =
      `time-logs_${from}_to_${to}` +
      slug(clients.find((c) => c.id === clientFilter)?.name) +
      slug(projects.find((p) => p.id === projectFilter)?.name) +
      slug(members.find((m) => m.id === memberFilter)?.name) +
      ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clientFilterItems = useMemo(
    () => [
      { id: "all", label: "All clients" },
      ...clients.map((c) => ({
        id: c.id,
        label: c.name,
        sub: c.contact_name || undefined,
      })),
    ],
    [clients]
  );
  const projectItems = useProjectItems();
  // Narrow the project list to the chosen client - one client, many projects.
  const projectFilterItems = useMemo(
    () => [
      { id: "all", label: "All projects" },
      ...projectItems.filter(
        (p) => clientFilter === "all" || clientOf(p.id) === clientFilter
      ),
    ],
    [projectItems, clientFilter, clientOf]
  );

  const pickClient = (id: string) => {
    setClientFilter(id);
    // Drop a project filter that belongs to a different client.
    if (
      id !== "all" &&
      projectFilter !== "all" &&
      clientOf(projectFilter) !== id
    ) {
      setProjectFilter("all");
    }
  };
  const memberFilterItems = useMemo(
    () => [
      { id: "all", label: "All members" },
      ...members.map((m) => ({ id: m.id, label: m.name, sub: m.email })),
    ],
    [members]
  );

  const maxMember = Math.max(1, ...byMember.map((r) => r.minutes));
  const maxProject = Math.max(1, ...byProject.map((r) => r.minutes));

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Admin · all time logs
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* filters */}
      <div className="card flex flex-wrap items-end gap-3 p-3.5">
        <label className="block">
          <Label>From</Label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            onClick={openPicker}
            onFocus={openPicker}
            className="input w-auto py-1 text-xs"
          />
        </label>
        <label className="block">
          <Label>To</Label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onClick={openPicker}
            onFocus={openPicker}
            className="input w-auto py-1 text-xs"
          />
        </label>
        <div className="min-w-[150px] flex-1">
          <Label>Client</Label>
          <ComboInput
            value={clientFilter}
            items={clientFilterItems}
            placeholder="All clients"
            emptyLabel="No matching client"
            onPick={pickClient}
            baseClass="input py-1 text-xs"
            className="w-full"
          />
        </div>
        <div className="min-w-[150px] flex-1">
          <Label>Project</Label>
          <ComboInput
            value={projectFilter}
            items={projectFilterItems}
            placeholder="All projects"
            emptyLabel="No matching project"
            onPick={setProjectFilter}
            baseClass="input py-1 text-xs"
            className="w-full"
          />
        </div>
        <div className="min-w-[150px] flex-1">
          <Label>Member</Label>
          <ComboInput
            value={memberFilter}
            items={memberFilterItems}
            placeholder="All members"
            emptyLabel="No matching member"
            onPick={setMemberFilter}
            baseClass="input py-1 text-xs"
            className="w-full"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="btn-outline gap-1.5 disabled:opacity-50"
          title="Download as CSV — opens in Excel"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* summary */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<Clock3 className="h-4 w-4" />}
          label="Logged"
          value={formatDuration(totalMinutes)}
          unit={`${filtered.length} ${
            filtered.length === 1 ? "entry" : "entries"
          }`}
          tone="indigo"
        />
        <Stat
          icon={<Users2 className="h-4 w-4" />}
          label="People logging"
          value={String(loggedUserIds.size)}
          unit={`of ${members.length}`}
        />
        <Stat
          icon={<Timer className="h-4 w-4" />}
          label="Avg / logged day"
          value={formatDuration(Math.round(totalMinutes / days))}
          unit={`${days} day${days === 1 ? "" : "s"} with logs`}
        />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="No log"
          value={String(missing.length)}
          unit={dayLabel(day)}
          tone={missing.length > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* breakdowns */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-border bg-surface-2/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            By member
          </div>
          <div className="divide-y divide-border">
            {byMember.map(({ member, minutes }, i) => (
              <BarRow
                key={member?.id ?? `unknown-${i}`}
                label={member?.name ?? "Unknown"}
                avatar={member}
                minutes={minutes}
                pct={(minutes / maxMember) * 100}
              />
            ))}
            {byMember.length === 0 && <Empty />}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-border bg-surface-2/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            By project
          </div>
          <div className="divide-y divide-border">
            {byProject.map(({ project, minutes }, i) => (
              <BarRow
                key={project?.id ?? `none-${i}`}
                label={project?.name ?? "No project"}
                minutes={minutes}
                pct={(minutes / maxProject) * 100}
              />
            ))}
            {byProject.length === 0 && <Empty />}
          </div>
        </div>
      </div>

      {/* who didn't log */}
      <div className="card mt-3 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/60 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            No time logged on {dayLabel(day)}
          </span>
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            onClick={openPicker}
            onFocus={openPicker}
            className="input w-auto py-0.5 text-xs"
          />
        </div>
        {missing.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">
            Everyone logged time.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-3">
            {missing.map((m) => (
              <span
                key={m.id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-2.5 text-xs text-muted"
              >
                <Avatar member={m} size="xs" />
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 px-1 text-xs text-faint">
        Totals cover {from} → {to}
        {clientFilter !== "all" &&
          ` · ${clients.find((c) => c.id === clientFilter)?.name}`}
        {projectFilter !== "all" &&
          ` · ${projects.find((p) => p.id === projectFilter)?.name}`}
        {memberFilter !== "all" &&
          ` · ${members.find((m) => m.id === memberFilter)?.name}`}
        . The export follows the same filters; the “no log” list covers the
        whole team on the day picked above.
      </p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">
      {children}
    </span>
  );
}

function BarRow({
  label,
  minutes,
  pct,
  avatar,
}: {
  label: string;
  minutes: number;
  pct: number;
  avatar?: TeamMember;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {avatar && <Avatar member={avatar} size="sm" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-fg">{label}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="shrink-0 text-sm font-semibold tabular-nums text-fg">
        {formatDuration(minutes)}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4 py-8 text-center text-sm text-faint">
      Nothing in this range.
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone?: "emerald" | "indigo" | "rose";
}) {
  const tones = {
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
  };
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone ? tones[tone] : "bg-surface-2 text-muted"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium uppercase tracking-wide text-faint">
          {label}
        </div>
        <div className="truncate text-lg font-semibold leading-tight text-fg">
          {value}
        </div>
        <div className="truncate text-[11px] text-faint">{unit}</div>
      </div>
    </div>
  );
}
