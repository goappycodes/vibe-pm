"use client";

import { Avatar } from "@/components/Avatar";
import { useStore } from "@/lib/store";
import {
  PROJECT_COLORS,
  STATUS_META,
  type Project,
  type Task,
} from "@/lib/types";
import { addDays, cn, parseDate, TODAY } from "@/lib/utils";
import { differenceInCalendarDays, format } from "date-fns";
import { Info, Minus, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const BASE_DAY_W = 30;
const MIN_DAY_W = 12;
const MAX_DAY_W = 72;
const G = 264; // gutter width
const AXIS_H = 46;
const HEADER_H = 34;
const ROW_H = 40;
const BAR_H = 22;

const clampDayW = (w: number) => Math.max(MIN_DAY_W, Math.min(MAX_DAY_W, w));

interface Placed {
  task: Task;
  rowTop: number;
  yCenter: number;
  startX: number;
  endX: number;
}
interface Group {
  project: Project;
  headerTop: number;
  rows: Placed[];
}

function durationDays(t: Task): number {
  if (!t.eta_hours) return 1;
  return Math.max(1, Math.min(10, Math.ceil(t.eta_hours / 8)));
}

export default function TimelinePage() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const activeProject = useStore((s) => s.activeProject);
  const dependencies = useStore((s) => s.dependencies);
  const members = useStore((s) => s.members);
  const openDetail = useStore((s) => s.openDetail);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dayWRef = useRef(BASE_DAY_W);
  const anchorRef = useRef<{ dayIndex: number; cursorOffset: number } | null>(
    null
  );
  const initedRef = useRef(false);
  const [dayW, setDayW] = useState(BASE_DAY_W);

  const visible = useMemo(
    () =>
      activeProject === "all"
        ? tasks
        : tasks.filter((t) => t.project_id === activeProject),
    [tasks, activeProject]
  );
  const dated = useMemo(() => visible.filter((t) => t.due_date), [visible]);
  const undatedCount = visible.length - dated.length;

  const layout = useMemo(() => {
    if (dated.length === 0) return null;

    let min = TODAY;
    let max = TODAY;
    for (const t of dated) {
      const due = parseDate(t.due_date)!;
      const start = addDays(due, -(durationDays(t) - 1));
      if (start < min) min = start;
      if (due > max) max = due;
    }
    const minDate = addDays(min, -2);
    const maxDate = addDays(max, 3);
    const numDays = differenceInCalendarDays(maxDate, minDate) + 1;
    const idx = (d: Date) => differenceInCalendarDays(d, minDate);

    const groups: Group[] = [];
    let y = AXIS_H;

    for (const project of projects) {
      const projTasks = dated
        .filter((t) => t.project_id === project.id)
        .sort((a, b) => {
          const sa = addDays(parseDate(a.due_date)!, -(durationDays(a) - 1));
          const sb = addDays(parseDate(b.due_date)!, -(durationDays(b) - 1));
          return sa.getTime() - sb.getTime();
        });
      if (projTasks.length === 0) continue;

      const headerTop = y;
      y += HEADER_H;
      const rows: Placed[] = [];
      for (const task of projTasks) {
        const due = parseDate(task.due_date)!;
        const start = addDays(due, -(durationDays(task) - 1));
        rows.push({
          task,
          rowTop: y,
          yCenter: y + ROW_H / 2,
          startX: idx(start) * dayW,
          endX: (idx(due) + 1) * dayW,
        });
        y += ROW_H;
      }
      groups.push({ project, headerTop, rows });
    }

    const chartW = numDays * dayW;
    const totalH = y + 8;
    const todayX = idx(TODAY) * dayW;
    const days = Array.from({ length: numDays }, (_, i) => addDays(minDate, i));

    return { groups, chartW, totalH, todayX, days };
  }, [dated, projects, dayW]);

  // Zoom around the cursor on Ctrl/Cmd + wheel.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorOffset = e.clientX - rect.left;
      const cur = dayWRef.current;
      const dayIndex = (el.scrollLeft + cursorOffset - G) / cur;
      const next = clampDayW(cur * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      if (next === cur) return;
      anchorRef.current = { dayIndex, cursorOffset };
      setDayW(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the cursor's day fixed after a zoom; sync the ref.
  useLayoutEffect(() => {
    dayWRef.current = dayW;
    const el = scrollRef.current;
    if (el && anchorRef.current) {
      const { dayIndex, cursorOffset } = anchorRef.current;
      el.scrollLeft = Math.max(0, G + dayIndex * dayW - cursorOffset);
      anchorRef.current = null;
    }
  }, [dayW]);

  // Center on today once.
  useEffect(() => {
    if (!layout || !scrollRef.current || initedRef.current) return;
    scrollRef.current.scrollLeft = Math.max(0, G + layout.todayX - 240);
    initedRef.current = true;
  }, [layout]);

  const zoomBy = (factor: number) => {
    const el = scrollRef.current;
    const cur = dayWRef.current;
    const next = clampDayW(cur * factor);
    if (next === cur) return;
    if (el) {
      const off = el.clientWidth / 2;
      anchorRef.current = {
        dayIndex: (el.scrollLeft + off - G) / cur,
        cursorOffset: off,
      };
    }
    setDayW(next);
  };
  const resetZoom = () => zoomBy(BASE_DAY_W / dayWRef.current);

  const zoomPct = Math.round((dayW / BASE_DAY_W) * 100);

  const links =
    layout &&
    dependencies
      .map((d) => {
        const flat = layout.groups.flatMap((g) => g.rows);
        const from = flat.find((p) => p.task.id === d.depends_on_task_id);
        const to = flat.find((p) => p.task.id === d.task_id);
        if (!from || !to) return null;
        return { from, to, violated: to.startX < from.endX - 0.5 };
      })
      .filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-border px-5 py-2 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-indigo-400" />
          Task (width ≈ effort)
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-rose-400" />
          At-risk dependency
        </span>
        <div className="ml-auto flex items-center gap-3">
          {undatedCount > 0 && (
            <span className="hidden items-center gap-1 md:flex">
              <Info className="h-3.5 w-3.5" />
              {undatedCount} undated hidden
            </span>
          )}
          <span className="hidden items-center gap-1 lg:flex">
            <span className="kbd">Ctrl</span>+ scroll to zoom
          </span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              onClick={() => zoomBy(1 / 1.2)}
              className="btn-ghost h-6 w-6 p-0"
              title="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={resetZoom}
              className="w-11 text-center text-[11px] font-medium tabular-nums text-muted hover:text-fg"
              title="Reset zoom"
            >
              {zoomPct}%
            </button>
            <button
              onClick={() => zoomBy(1.2)}
              className="btn-ghost h-6 w-6 p-0"
              title="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {!layout ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">
          No dated tasks to place on the timeline.
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <div
            className="relative"
            style={{ width: G + layout.chartW, height: layout.totalH }}
          >
            {/* weekend shading */}
            {layout.days.map((d, i) => {
              const wd = d.getDay();
              if (wd !== 0 && wd !== 6) return null;
              return (
                <div
                  key={`wk-${i}`}
                  className="absolute top-0 bg-surface-2/60"
                  style={{
                    left: G + i * dayW,
                    width: dayW,
                    height: layout.totalH,
                  }}
                />
              );
            })}

            {/* today line */}
            <div
              className="absolute top-0 z-10 w-px bg-accent"
              style={{
                left: G + layout.todayX + dayW / 2,
                height: layout.totalH,
              }}
            >
              <span className="absolute -left-6 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">
                Today
              </span>
            </div>

            {/* axis */}
            <div
              className="absolute left-0 top-0 z-20 flex border-b border-border bg-bg"
              style={{ width: G + layout.chartW, height: AXIS_H }}
            >
              <div
                className="shrink-0 border-r border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint"
                style={{ width: G }}
              >
                Project · Task
              </div>
              <div className="relative" style={{ width: layout.chartW }}>
                {layout.days.map((d, i) => {
                  const isFirst = d.getDate() === 1 || i === 0;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 text-center"
                      style={{ left: i * dayW, width: dayW, height: AXIS_H }}
                    >
                      {isFirst && (
                        <div className="absolute left-1 top-1 whitespace-nowrap text-[11px] font-semibold text-fg">
                          {format(d, "MMM")}
                        </div>
                      )}
                      {(dayW >= 20 || d.getDate() % 2 === 1) && (
                        <div
                          className={cn(
                            "absolute bottom-1 left-0 w-full text-[10px]",
                            d.getDay() === 0 || d.getDay() === 6
                              ? "text-faint"
                              : "text-muted"
                          )}
                        >
                          {format(d, "d")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* dependency links */}
            <svg
              className="pointer-events-none absolute z-10"
              style={{ left: G, top: 0, width: layout.chartW, height: layout.totalH }}
              width={layout.chartW}
              height={layout.totalH}
            >
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-faint" />
                </marker>
                <marker id="arrow-risk" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-rose-400" />
                </marker>
              </defs>
              {(links || []).map((l, i) => {
                const { from, to, violated } = l!;
                const x1 = from.endX;
                const y1 = from.yCenter;
                const x2 = to.startX;
                const y2 = to.yCenter;
                const midX = Math.max(x1 + 14, (x1 + x2) / 2);
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 3} ${y2}`}
                    fill="none"
                    strokeWidth={1.5}
                    className={violated ? "stroke-rose-400" : "stroke-faint"}
                    strokeDasharray={violated ? "4 3" : undefined}
                    markerEnd={`url(#${violated ? "arrow-risk" : "arrow"})`}
                  />
                );
              })}
            </svg>

            {/* groups + rows */}
            {layout.groups.map((group) => {
              const c =
                PROJECT_COLORS[group.project.color] ?? PROJECT_COLORS.indigo;
              return (
                <div key={group.project.id}>
                  <div
                    className="absolute left-0 z-[5] flex items-center gap-2 border-y border-border bg-surface-2/70 px-4"
                    style={{
                      top: group.headerTop,
                      width: G + layout.chartW,
                      height: HEADER_H,
                    }}
                  >
                    <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                    <span className="text-xs font-semibold text-fg">
                      {group.project.name}
                    </span>
                    <span className="text-[11px] text-faint">
                      {group.rows.length}
                    </span>
                  </div>

                  {group.rows.map((placed) => {
                    const t = placed.task;
                    const assignee = members.find((m) => m.id === t.assignee_id);
                    const done = t.status === "done";
                    return (
                      <div key={t.id}>
                        <div
                          className="absolute left-0 z-[5] flex items-center gap-2 border-b border-border/60 bg-bg px-4"
                          style={{ top: placed.rowTop, width: G, height: ROW_H }}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              STATUS_META[t.status].dot
                            )}
                          />
                          <button
                            onClick={() => openDetail(t.id)}
                            className={cn(
                              "min-w-0 flex-1 truncate text-left text-sm text-fg hover:text-accent",
                              done && "text-faint line-through"
                            )}
                          >
                            {t.title}
                          </button>
                          <Avatar member={assignee} size="xs" />
                        </div>

                        <button
                          onClick={() => openDetail(t.id)}
                          className={cn(
                            "absolute z-[6] flex items-center overflow-hidden rounded-md border-l-4 px-2 text-[11px] font-medium shadow-soft transition-transform hover:-translate-y-px",
                            c.soft,
                            c.text,
                            done && "opacity-50"
                          )}
                          style={{
                            left: G + placed.startX,
                            width: Math.max(placed.endX - placed.startX, 10),
                            top: placed.rowTop + (ROW_H - BAR_H) / 2,
                            height: BAR_H,
                            borderLeftColor: "currentColor",
                          }}
                          title={t.title}
                        >
                          <span className="truncate">{t.title}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
