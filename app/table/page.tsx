"use client";

import { Avatar } from "@/components/Avatar";
import { MenuItem, Popover } from "@/components/Popover";
import {
  AssigneePicker,
  DatePicker,
  ProjectPicker,
  StatusPicker,
  UrgencyPicker,
} from "@/components/Pickers";
import { useStore } from "@/lib/store";
import {
  STATUSES,
  STATUS_META,
  URGENCIES,
  URGENCY_META,
  type Status,
  type Task,
  type Urgency,
} from "@/lib/types";
import { addDays, cn, daysFromToday, toISODate, TODAY } from "@/lib/utils";
import {
  ArrowDownUp,
  Calendar,
  CircleUser,
  Maximize2,
  Signal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type SortKey = "due" | "urgency" | "status" | "title";
const COLS = "grid grid-cols-[32px_minmax(0,1fr)_150px_140px_140px_110px_96px_36px] items-center gap-2";

export default function TablePage() {
  const tasks = useStore((s) => s.tasks);
  const activeProject = useStore((s) => s.activeProject);
  const updateTask = useStore((s) => s.updateTask);
  const openDetail = useStore((s) => s.openDetail);
  const selected = useStore((s) => s.selectedTaskIds);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "due",
    dir: 1,
  });

  const rows = useMemo(() => {
    let list =
      activeProject === "all"
        ? tasks
        : tasks.filter((t) => t.project_id === activeProject);
    const dir = sort.dir;
    list = [...list].sort((a, b) => {
      switch (sort.key) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "urgency":
          return (
            (URGENCY_META[a.urgency].rank - URGENCY_META[b.urgency].rank) * dir
          );
        case "status":
          return (
            (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) * dir
          );
        case "due": {
          const da = daysFromToday(a.due_date);
          const db = daysFromToday(b.due_date);
          if (da === null) return 1;
          if (db === null) return -1;
          return (da - db) * dir;
        }
      }
    });
    return list;
  }, [tasks, activeProject, sort]);

  const allSelected = rows.length > 0 && rows.every((t) => selected.includes(t.id));
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) clearSelection();
    else selectMany(rows.map((t) => t.id));
  };

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* header */}
          <div
            className={cn(
              COLS,
              "sticky top-0 z-10 border-b border-border bg-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint"
            )}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={toggleAll}
              className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-accent"
            />
            <HeaderCell label="Task" active={sort.key === "title"} dir={sort.dir} onClick={() => setSortKey("title")} />
            <span>Project</span>
            <span>Assignee</span>
            <HeaderCell label="Status" active={sort.key === "status"} dir={sort.dir} onClick={() => setSortKey("status")} />
            <HeaderCell label="Urgency" active={sort.key === "urgency"} dir={sort.dir} onClick={() => setSortKey("urgency")} />
            <HeaderCell label="Due" active={sort.key === "due"} dir={sort.dir} onClick={() => setSortKey("due")} />
            <span />
          </div>

          {/* rows */}
          <div>
            {rows.map((task) => (
              <TableRow
                key={task.id}
                task={task}
                selected={selected.includes(task.id)}
                onToggle={() => toggleSelect(task.id)}
                onOpen={() => openDetail(task.id)}
                onUpdate={(patch) => updateTask(task.id, patch)}
              />
            ))}
            {rows.length === 0 && (
              <div className="px-4 py-16 text-center text-sm text-faint">
                No tasks in this project.
              </div>
            )}
          </div>
        </div>
      </div>

      {selected.length > 0 && <BulkBar />}
    </div>
  );
}

function HeaderCell({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-left uppercase hover:text-muted",
        active && "text-accent"
      )}
    >
      {label}
      <ArrowDownUp
        className={cn("h-3 w-3", active ? "opacity-100" : "opacity-0")}
        style={active && dir === -1 ? { transform: "scaleY(-1)" } : undefined}
      />
    </button>
  );
}

function TableRow({
  task,
  selected,
  onToggle,
  onOpen,
  onUpdate,
}: {
  task: Task;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onUpdate: (patch: Partial<Task>) => void;
}) {
  return (
    <div
      className={cn(
        COLS,
        "group border-b border-border/70 px-4 py-1.5 transition-colors hover:bg-surface",
        selected && "bg-accent-soft/60"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-accent"
      />
      <input
        value={task.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        className={cn(
          "min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-fg outline-none hover:border-border focus:border-accent focus:bg-surface-2",
          task.status === "done" && "text-faint line-through"
        )}
      />
      <ProjectPicker
        value={task.project_id}
        onChange={(id) => onUpdate({ project_id: id })}
      />
      <AssigneePicker
        value={task.assignee_id}
        onChange={(id) => onUpdate({ assignee_id: id })}
      />
      <StatusPicker
        value={task.status}
        onChange={(s) => onUpdate({ status: s })}
      />
      <UrgencyPicker
        value={task.urgency}
        onChange={(u) => onUpdate({ urgency: u })}
      />
      <DatePicker
        value={task.due_date}
        onChange={(d) => onUpdate({ due_date: d })}
      />
      <button
        onClick={onOpen}
        className="flex h-6 w-6 items-center justify-center rounded-md text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg group-hover:opacity-100"
        title="Open details"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BulkBar() {
  const selected = useStore((s) => s.selectedTaskIds);
  const bulkUpdate = useStore((s) => s.bulkUpdate);
  const clearSelection = useStore((s) => s.clearSelection);
  const members = useStore((s) => s.members);

  const apply = (patch: Parameters<typeof bulkUpdate>[1]) => {
    bulkUpdate(selected, patch);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface p-1.5 pl-3 shadow-pop">
        <span className="mr-1 text-sm font-medium text-fg">
          {selected.length} selected
        </span>
        <span className="mx-1 h-5 w-px bg-border" />

        <BulkMenu
          icon={<Signal className="h-3.5 w-3.5" />}
          label="Status"
          width={180}
        >
          {(close) =>
            STATUSES.map((s) => (
              <MenuItem
                key={s}
                onClick={() => {
                  apply({ status: s });
                  close();
                }}
              >
                <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                <span className={STATUS_META[s].color}>
                  {STATUS_META[s].label}
                </span>
              </MenuItem>
            ))
          }
        </BulkMenu>

        <BulkMenu
          icon={<CircleUser className="h-3.5 w-3.5" />}
          label="Assignee"
          width={220}
        >
          {(close) => (
            <div className="max-h-72 overflow-y-auto">
              {members.map((m) => (
                <MenuItem
                  key={m.id}
                  onClick={() => {
                    apply({ assignee_id: m.id });
                    close();
                  }}
                >
                  <Avatar member={m} size="sm" />
                  {m.name}
                </MenuItem>
              ))}
            </div>
          )}
        </BulkMenu>

        <BulkMenu
          icon={<Signal className="h-3.5 w-3.5 rotate-90" />}
          label="Urgency"
          width={160}
        >
          {(close) =>
            URGENCIES.map((u) => (
              <MenuItem
                key={u}
                onClick={() => {
                  apply({ urgency: u });
                  close();
                }}
              >
                <span className={cn("chip", URGENCY_META[u].className)}>
                  {URGENCY_META[u].label}
                </span>
              </MenuItem>
            ))
          }
        </BulkMenu>

        <BulkMenu
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Due"
          width={200}
        >
          {(close) => {
            const opts: { label: string; d: string | null }[] = [
              { label: "Today", d: toISODate(TODAY) },
              { label: "Tomorrow", d: toISODate(addDays(TODAY, 1)) },
              { label: "In 1 week", d: toISODate(addDays(TODAY, 7)) },
              { label: "Clear", d: null },
            ];
            return opts.map((o) => (
              <MenuItem
                key={o.label}
                onClick={() => {
                  apply({ due_date: o.d });
                  close();
                }}
              >
                {o.label}
              </MenuItem>
            ));
          }}
        </BulkMenu>

        <span className="mx-1 h-5 w-px bg-border" />
        <button
          onClick={clearSelection}
          className="btn-ghost h-8 w-8 p-0"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BulkMenu({
  icon,
  label,
  width,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  width: number;
  children: (close: () => void) => React.ReactNode;
}) {
  return (
    <Popover
      width={width}
      align="start"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="btn-ghost gap-1.5">
          {icon}
          {label}
        </button>
      )}
    >
      {(close) => <div className="py-1">{children(close)}</div>}
    </Popover>
  );
}
