"use client";

import { useStore } from "@/lib/store";
import type { Project } from "@/lib/types";
import { Folder, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AssigneePicker,
  ClientPicker,
  DatePicker,
  SlackChannelPicker,
} from "./Pickers";
import { ProjectColorPicker, ProjectStatusPicker } from "./ProjectPickers";

type Draft = Omit<Project, "id">;

/**
 * Collects a project's details before it exists. Creating first and editing
 * after left an untitled row in the list (and the DB) on every stray click.
 */
export function NewProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addProject = useStore((s) => s.addProject);
  const currentUserId = useStore((s) => s.currentUserId);
  const projects = useStore((s) => s.projects);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    owner_id: currentUserId,
    client_id: null,
    status: "active",
    color: "indigo",
    slack_channel_id: null,
    git_repo_url: null,
    target_date: null,
  });
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  useEffect(() => setMounted(true), []);

  // Start from a clean slate every time it opens.
  useEffect(() => {
    if (!open) return;
    setDraft({
      name: "",
      owner_id: currentUserId,
      client_id: null,
      status: "active",
      color: "indigo",
      slack_channel_id: null,
      git_repo_url: null,
      target_date: null,
    });
    setSaving(false);
  }, [open, currentUserId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const name = draft.name.trim();
  const duplicate = projects.some(
    (p) => p.name.trim().toLowerCase() === name.toLowerCase()
  );

  const create = () => {
    if (!name || saving) return;
    setSaving(true);
    const id = addProject({ ...draft, name });
    onCreated?.(id);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-pop animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Folder className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-fg">New project</h2>
        </div>

        <div className="p-5">
          <label className="block">
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              autoFocus
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="e.g. Hub Culture — Phase 4"
              className="input"
            />
          </label>
          {duplicate && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              A project with this name already exists.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Client">
              <ClientPicker
                full
                value={draft.client_id}
                onChange={(id) => patch({ client_id: id })}
              />
            </Field>
            <Field label="Owner">
              <AssigneePicker
                full
                value={draft.owner_id}
                onChange={(id) => patch({ owner_id: id ?? currentUserId })}
              />
            </Field>
            <Field label="Slack channel">
              <SlackChannelPicker
                full
                value={draft.slack_channel_id}
                onChange={(n) => patch({ slack_channel_id: n })}
              />
            </Field>
            <Field label="Target date">
              <DatePicker
                full
                value={draft.target_date}
                onChange={(d) => patch({ target_date: d })}
              />
            </Field>
            <Field label="Status">
              <ProjectStatusPicker
                full
                value={draft.status}
                onChange={(status) => patch({ status })}
              />
            </Field>
            <Field label="Colour">
              <div className="flex h-7 items-center">
                <ProjectColorPicker
                  value={draft.color}
                  onChange={(color) => patch({ color })}
                />
              </div>
            </Field>
          </div>

          <label className="mt-4 block">
            <FieldLabel>Git repo</FieldLabel>
            <input
              type="text"
              value={draft.git_repo_url ?? ""}
              onChange={(e) =>
                patch({ git_repo_url: e.target.value.trim() || null })
              }
              placeholder="https://github.com/org/repo (optional)"
              className="input"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="btn-ghost text-sm text-muted">
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!name || saving}
            className="btn-primary gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create project
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
