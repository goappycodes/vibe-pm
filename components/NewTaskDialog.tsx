"use client";

import { useStore } from "@/lib/store";
import type { Status, Urgency } from "@/lib/types";
import { STORY_POINTS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AssigneePicker,
  DatePicker,
  ProjectPicker,
  StatusPicker,
  UrgencyPicker,
} from "./Pickers";

/**
 * Collects a task before it exists.
 *
 * "New task" used to insert an "Untitled task" immediately, guessing the
 * project — which fired a Slack "new task" notice into whichever channel that
 * guess landed on, usually the wrong one. Nothing is written until Create.
 */
export function NewTaskDialog() {
  const open = useStore((s) => s.newTaskOpen);
  const setOpen = useStore((s) => s.setNewTaskOpen);
  const addTask = useStore((s) => s.addTask);
  const openDetail = useStore((s) => s.openDetail);
  const currentUserId = useStore((s) => s.currentUserId);
  const defaultProjectId = useStore((s) => s.defaultProjectId);
  const projectById = useStore((s) => s.projectById);

  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignee, setAssignee] = useState<string | null>(currentUserId);
  const [due, setDue] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("todo");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setProjectId(defaultProjectId());
    setAssignee(currentUserId);
    setDue(null);
    setStatus("todo");
    setUrgency("medium");
    setPoints(null);
    setSaving(false);
  }, [open, currentUserId, defaultProjectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open || !mounted) return null;

  const name = title.trim();
  const project = projectById(projectId);
  // Projects seeded from Slack use the channel id as their own id; others
  // carry it separately. Neither means the project has a channel at all.
  const slackId = /^[CGD][A-Z0-9]{6,}$/.test(project?.id ?? "")
    ? project?.id
    : project?.slack_channel_id ?? null;

  const create = () => {
    if (!name || !projectId || saving) return;
    setSaving(true);
    const id = addTask({
      title: name,
      project_id: projectId,
      assignee_id: assignee,
      due_date: due,
      status,
      urgency,
      story_points: points,
    });
    setOpen(false);
    openDetail(id);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-pop animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Plus className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-fg">New task</h2>
        </div>

        <div className="p-5">
          <label className="block">
            <FieldLabel>Title</FieldLabel>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="What needs doing?"
              className="input"
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Project">
              <ProjectPicker full value={projectId} onChange={setProjectId} />
            </Field>
            <Field label="Assignee">
              <AssigneePicker full value={assignee} onChange={setAssignee} />
            </Field>
            <Field label="Due date">
              <DatePicker full value={due} onChange={setDue} />
            </Field>
            <Field label="Status">
              <StatusPicker full value={status} onChange={setStatus} />
            </Field>
            <Field label="Urgency">
              <UrgencyPicker full value={urgency} onChange={setUrgency} />
            </Field>
            <Field label="Story points">
              <div className="flex flex-wrap gap-1">
                {STORY_POINTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPoints(points === p ? null : p)}
                    className={cn(
                      "h-6 w-6 rounded-md text-xs font-semibold tabular-nums transition-colors",
                      points === p
                        ? "bg-accent text-accent-fg"
                        : "bg-surface-2 text-muted hover:text-fg"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <p className="mt-4 text-xs text-faint">
            {!projectId
              ? "Pick a project — it decides which Slack channel hears about this."
              : slackId
                ? `Slack gets one "new task" notice in ${
                    slackId.startsWith("C") ? project?.name : "#" + slackId
                  }.`
                : `${project?.name} has no Slack channel — nothing will be posted.`}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost text-sm text-muted"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!name || !projectId || saving}
            className="btn-primary gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create task
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}
