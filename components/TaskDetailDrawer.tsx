"use client";
import { EditableText } from "./EditableText";

import { useStore } from "@/lib/store";
import { STATUS_META, type UpdateSource } from "@/lib/types";
import { cn, cycleTime, formatDateLong } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  Check,
  FileText,
  GitCommitVertical,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { MenuItem, Popover } from "./Popover";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./Avatar";
import { ProjectBadge } from "./Badges";
import {
  AssigneePicker,
  DatePicker,
  ProjectPicker,
  StatusPicker,
  StoryPointsPicker,
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
  const deleteTask = useStore((s) => s.deleteTask);
  const addDependency = useStore((s) => s.addDependency);
  const removeDependency = useStore((s) => s.removeDependency);
  const dependencies = useStore((s) => s.dependencies);
  const tasks = useStore((s) => s.tasks);
  const members = useStore((s) => s.members);
  const projects = useStore((s) => s.projects);
  const activity = useStore((s) => s.activity);
  const comments = useStore((s) => s.comments);
  const addComment = useStore((s) => s.addComment);
  const removeComment = useStore((s) => s.removeComment);
  const attachments = useStore((s) => s.attachments);
  const addAttachment = useStore((s) => s.addAttachment);
  const removeAttachment = useStore((s) => s.removeAttachment);
  const currentUserId = useStore((s) => s.currentUserId);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(""), [detailTaskId]);

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
  const taskComments = comments
    .filter((c) => c.task_id === task.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const currentUser = members.find((m) => m.id === currentUserId);

  const postComment = () => {
    if (!draft.trim()) return;
    addComment(task.id, draft);
    setDraft("");
  };

  const taskAttachments = attachments.filter((a) => a.task_id === task.id);
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setUploading((u) => u + arr.length);
    for (const f of arr) {
      await addAttachment(task.id, f);
      setUploading((u) => u - 1);
    }
  };

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
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (confirm("Delete this task? This cannot be undone.")) {
                  deleteTask(task.id);
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              title="Delete task"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={closeDetail}
              className="btn-ghost h-8 w-8 p-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4">
            <EditableText
              as="textarea"
              rows={2}
              enterCommits
              value={task.title}
              onCommit={(title) => updateTask(task.id, { title })}
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
            <Field label="Story points">
              <StoryPointsPicker
                value={task.story_points}
                onChange={(v) => updateTask(task.id, { story_points: v })}
              />
            </Field>
            {task.status === "done" && task.completed_at && (
              <Field label="Time to complete">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  {cycleTime(task.created_at, task.completed_at)?.long ?? "—"}
                </span>
              </Field>
            )}
          </div>

          {/* description */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-1.5 text-xs font-medium text-faint">
              Description
            </div>
            <EditableText
              as="textarea"
              value={task.description}
              onCommit={(description) =>
                updateTask(task.id, { description })
              }
              rows={3}
              placeholder="Add a description…"
              className="w-full resize-none rounded-lg border border-transparent bg-transparent text-sm leading-relaxed text-fg outline-none placeholder:text-faint hover:border-border focus:border-accent focus:bg-surface-2 px-2 py-1.5 -mx-2"
            />
          </div>

          {/* dependencies */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-faint">
                <Link2 className="h-3.5 w-3.5" /> Dependencies
              </div>
              <Popover
                width={280}
                align="end"
                trigger={({ toggle }) => (
                  <button
                    onClick={toggle}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                )}
              >
                {(close) => {
                  const candidates = tasks.filter(
                    (t) =>
                      t.id !== task.id &&
                      !dependsOn.some((d) => d!.id === t.id) &&
                      !dependencies.some(
                        (d) =>
                          d.task_id === t.id && d.depends_on_task_id === task.id
                      )
                  );
                  return (
                    <div className="max-h-72 overflow-y-auto py-1">
                      <div className="px-2.5 pb-1 pt-0.5 text-[11px] text-faint">
                        This task depends on…
                      </div>
                      {candidates.length === 0 && (
                        <div className="px-2.5 py-2 text-xs text-faint">
                          No other tasks available.
                        </div>
                      )}
                      {candidates.slice(0, 40).map((c) => (
                        <MenuItem
                          key={c.id}
                          onClick={() => {
                            addDependency(task.id, c.id);
                            close();
                          }}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              STATUS_META[c.status].dot
                            )}
                          />
                          <span className="flex-1 truncate">{c.title}</span>
                        </MenuItem>
                      ))}
                    </div>
                  );
                }}
              </Popover>
            </div>

            {dependsOn.length === 0 && blocks.length === 0 && (
              <div className="text-xs text-faint">
                No dependencies yet.
              </div>
            )}
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
                      onRemove={() => removeDependency(task.id, d!.id)}
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
                      onRemove={() => removeDependency(d!.id, task.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* attachments */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-faint">
                <Paperclip className="h-3.5 w-3.5" /> Attachments
                {taskAttachments.length > 0 && (
                  <span className="text-faint">· {taskAttachments.length}</span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {taskAttachments.length === 0 && uploading === 0 && (
              <div className="text-xs text-faint">No files attached.</div>
            )}
            <div className="space-y-1">
              {taskAttachments.map((a) => (
                <div
                  key={a.id}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5"
                >
                  <FileText className="h-4 w-4 shrink-0 text-faint" />
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm text-fg hover:text-accent"
                  >
                    {a.file_name}
                  </a>
                  <span className="shrink-0 text-[11px] text-faint">
                    {formatSize(a.size)}
                  </span>
                  {a.author_id === currentUserId && (
                    <button
                      onClick={() => removeAttachment(a.id)}
                      className="shrink-0 text-faint opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                      title="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {uploading > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-faint">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading {uploading} file{uploading === 1 ? "" : "s"}…
                </div>
              )}
            </div>
          </div>

          {/* comments */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-faint">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
              {taskComments.length > 0 && (
                <span className="text-faint">· {taskComments.length}</span>
              )}
            </div>

            {taskComments.length > 0 && (
              <ul className="mb-3 space-y-3">
                {taskComments.map((c) => {
                  const author = members.find((m) => m.id === c.author_id);
                  return (
                    <li key={c.id} className="group flex gap-2.5">
                      <Avatar member={author} size="sm" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-fg">
                            {author?.name.split(" ")[0] ?? "Someone"}
                          </span>
                          <span className="text-[11px] text-faint">
                            {format(parseISO(c.created_at), "MMM d, h:mm a")}
                          </span>
                          {c.author_id === currentUserId && (
                            <button
                              onClick={() => removeComment(c.id)}
                              className="ml-auto text-faint opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                              title="Delete comment"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                          {c.body}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-start gap-2.5">
              <Avatar member={currentUser} size="sm" className="mt-1" />
              <div className="min-w-0 flex-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                  rows={2}
                  placeholder="Add a comment…"
                  className="input resize-none text-sm"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-faint">⌘↵ to send</span>
                  <button
                    onClick={postComment}
                    disabled={!draft.trim()}
                    className="btn-primary gap-1.5 py-1 text-xs disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </div>

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

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DepRow({
  title,
  status,
  onClick,
  onRemove,
}: {
  title: string;
  status: keyof typeof STATUS_META;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm transition-colors hover:border-border-strong">
      <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="flex-1 truncate text-fg">{title}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10"
          title="Remove dependency"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
