"use client";

import { useStore } from "@/lib/store";
import { STATUS_META, type UpdateSource } from "@/lib/types";
import { cn, formatDateLong } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  Clock,
  GitCommitVertical,
  Link2,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./Avatar";
import { ProjectBadge } from "./Badges";
import {
  AssigneePicker,
  DatePicker,
  ProjectPicker,
  StatusPicker,
  UrgencyPicker,
} from "./Pickers";

const SOURCE_LABEL: Record<UpdateSource, string> = {
  ui: "Dashboard",
  slack: "Slack",
  claude: "Claude",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 shrink-0 text-xs font-medium text-faint">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TaskDetailDrawer() {
  const detailTaskId = useStore((s) => s.detailTaskId);
  const closeDetail = useStore((s) => s.closeDetail);
  const task = useStore((s) =>
    s.tasks.find((t) => t.id === s.detailTaskId)
  );
  const updateTask = useStore((s) => s.updateTask);
  const openDetail = useStore((s) => s.openDetail);
  const dependencies = useStore((s) => s.dependencies);
  const tasks = useStore((s) => s.tasks);
  const members = useStore((s) => s.members);
  const projects = useStore((s) => s.projects);
  const activity = useStore((s) => s.activity);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    if (detailTaskId) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailTaskId, closeDetail]);

  if (!detailTaskId || !task) return null;

  const project = projects.find((p) => p.id === task.project_id);
  const dependsOn = dependencies
    .filter((d) => d.task_id === task.id)
    .map((d) => tasks.find((t) => t.id === d.depends_on_task_id))
    .filter(Boolean);
  const blocks = dependencies
    .filter((d) => d.depends_on_task_id === task.id)
    .map((d) => tasks.find((t) => t.id === d.task_id))
    .filter(Boolean);
  const taskActivity = activity.filter((a) => a.task_id === task.id);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 animate-fade-in"
        onClick={closeDetail}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-pop animate-fade-in">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <ProjectBadge project={project} />
          <button
            onClick={closeDetail}
            className="btn-ghost h-8 w-8 p-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4">
            <textarea
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              rows={2}
              className="w-full resize-none bg-transparent text-lg font-semibold leading-snug text-fg outline-none placeholder:text-faint"
              placeholder="Task title"
            />
          </div>

          <div className="border-b border-border px-4 pb-3">
            <Field label="Status">
              <StatusPicker
                value={task.status}
                onChange={(s) => updateTask(task.id, { status: s })}
              />
            </Field>
            <Field label="Assignee">
              <AssigneePicker
                value={task.assignee_id}
                onChange={(id) => updateTask(task.id, { assignee_id: id })}
              />
            </Field>
            <Field label="Due date">
              <DatePicker
                value={task.due_date}
                onChange={(d) => updateTask(task.id, { due_date: d })}
              />
            </Field>
            <Field label="Urgency">
              <UrgencyPicker
                value={task.urgency}
                onChange={(u) => updateTask(task.id, { urgency: u })}
              />
            </Field>
            <Field label="Project">
              <ProjectPicker
                value={task.project_id}
                onChange={(id) => updateTask(task.id, { project_id: id })}
              />
            </Field>
            <Field label="ETA">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-faint" />
                <input
                  type="number"
                  min={0}
                  value={task.eta_hours ?? ""}
                  onChange={(e) =>
                    updateTask(task.id, {
                      eta_hours: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="w-16 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-fg outline-none hover:border-border focus:border-accent"
                  placeholder="—"
                />
                <span className="text-xs text-faint">hours</span>
              </div>
            </Field>
          </div>

          {/* description */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-1.5 text-xs font-medium text-faint">
              Description
            </div>
            <textarea
              value={task.description}
              onChange={(e) =>
                updateTask(task.id, { description: e.target.value })
              }
              rows={3}
              placeholder="Add a description…"
              className="w-full resize-none rounded-lg border border-transparent bg-transparent text-sm leading-relaxed text-fg outline-none placeholder:text-faint hover:border-border focus:border-accent focus:bg-surface-2 px-2 py-1.5 -mx-2"
            />
          </div>

          {/* dependencies */}
          {(dependsOn.length > 0 || blocks.length > 0) && (
            <div className="border-b border-border px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-faint">
                <Link2 className="h-3.5 w-3.5" /> Dependencies
              </div>
              {dependsOn.length > 0 && (
                <div className="mb-2">
                  <div className="mb-1 text-[11px] text-faint">Depends on</div>
                  <div className="space-y-1">
                    {dependsOn.map((d) => (
                      <DepRow
                        key={d!.id}
                        title={d!.title}
                        status={d!.status}
                        onClick={() => openDetail(d!.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {blocks.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] text-faint">Blocks</div>
                  <div className="space-y-1">
                    {blocks.map((d) => (
                      <DepRow
                        key={d!.id}
                        title={d!.title}
                        status={d!.status}
                        onClick={() => openDetail(d!.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* activity */}
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-faint">
              <GitCommitVertical className="h-3.5 w-3.5" /> Activity
            </div>
            {taskActivity.length === 0 ? (
              <div className="text-xs text-faint">No activity yet.</div>
            ) : (
              <ul className="space-y-2.5">
                {taskActivity.map((a) => {
                  const actor = members.find((m) => m.id === a.actor_id);
                  return (
                    <li key={a.id} className="flex gap-2.5 text-xs">
                      <Avatar member={actor} size="xs" className="mt-0.5" />
                      <div className="flex-1 leading-relaxed">
                        <span className="font-medium text-fg">
                          {actor?.name.split(" ")[0]}
                        </span>{" "}
                        <span className="text-muted">
                          changed {a.field}
                          {a.from ? (
                            <>
                              {" "}
                              from{" "}
                              <span className="text-fg">
                                {a.from.replace(/_/g, " ")}
                              </span>
                            </>
                          ) : null}{" "}
                          to{" "}
                          <span className="text-fg">
                            {a.to?.replace(/_/g, " ")}
                          </span>
                        </span>
                        <div className="mt-0.5 text-faint">
                          {SOURCE_LABEL[a.source]} ·{" "}
                          {format(parseISO(a.at), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-border px-4 py-2.5 text-[11px] text-faint">
          Created {formatDateLong(task.created_at)} · Updated{" "}
          {format(parseISO(task.updated_at), "MMM d, h:mm a")}
        </div>
      </div>
    </div>,
    document.body
  );
}

function DepRow({
  title,
  status,
  onClick,
}: {
  title: string;
  status: keyof typeof STATUS_META;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:border-border-strong"
    >
      <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
      <span className="flex-1 truncate text-fg">{title}</span>
      <ArrowRight className="h-3.5 w-3.5 text-faint" />
    </button>
  );
}
