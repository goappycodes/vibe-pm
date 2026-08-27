"use client";

import { Avatar } from "@/components/Avatar";
import { MenuItem, Popover } from "@/components/Popover";
import {
  AssigneePicker,
  ClientPicker,
  DatePicker,
  SlackChannelPicker,
} from "@/components/Pickers";
import { useStore } from "@/lib/store";
import { PROJECT_COLORS, type Project } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { ArrowUpRight, Check, Folder, Lock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

const PROJECT_STATUS: {
  v: Project["status"];
  label: string;
  dot: string;
  text: string;
}[] = [
  { v: "active", label: "Active", dot: "bg-emerald-500", text: "text-emerald-600" },
  { v: "paused", label: "Paused", dot: "bg-amber-500", text: "text-amber-600" },
  { v: "done", label: "Done", dot: "bg-slate-400", text: "text-slate-500" },
];

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const addProject = useStore((s) => s.addProject);
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Folder className="h-4 w-4 text-faint" />
            {projects.length} projects
          </div>
          {isAdmin ? (
            <button onClick={() => addProject()} className="btn-primary gap-1.5">
              <Plus className="h-4 w-4" />
              New project
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-faint">
              <Lock className="h-3.5 w-3.5" />
              Only admins can manage projects
            </span>
          )}
        </div>

        <div className="space-y-3">
          {projects.map((p) => {
            const open = tasks.filter(
              (t) => t.project_id === p.id && t.status !== "done"
            ).length;
            const total = tasks.filter((t) => t.project_id === p.id).length;
            return (
              <ProjectCard
                key={p.id}
                project={p}
                openTasks={open}
                totalTasks={total}
                editable={isAdmin}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  openTasks,
  totalTasks,
  editable,
}: {
  project: Project;
  openTasks: number;
  totalTasks: number;
  editable: boolean;
}) {
  const updateProject = useStore((s) => s.updateProject);
  const removeProject = useStore((s) => s.removeProject);
  const c = PROJECT_COLORS[project.color] ?? PROJECT_COLORS.indigo;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <ColorPicker
            value={project.color}
            disabled={!editable}
            onChange={(color) => updateProject(project.id, { color })}
          />
          <Link
            href={`/project/${project.id}`}
            className="group flex min-w-0 items-center gap-1 truncate text-base font-semibold text-fg hover:text-accent"
          >
            <span className="truncate">{project.name}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ProjectStatusPicker
            value={project.status}
            disabled={!editable}
            onChange={(status) => updateProject(project.id, { status })}
          />
          {editable && (
            <button
              onClick={() => removeProject(project.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              title="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Field label="Client">
          <ClientPicker
            value={project.client_id}
            onChange={(id) => updateProject(project.id, { client_id: id })}
          />
        </Field>
        <Field label="Owner">
          <AssigneePicker
            value={project.owner_id}
            onChange={(id) =>
              updateProject(project.id, { owner_id: id ?? project.owner_id })
            }
          />
        </Field>
        <Field label="Slack channel">
          <SlackChannelPicker
            value={project.slack_channel_id}
            onChange={(name) =>
              updateProject(project.id, { slack_channel_id: name })
            }
          />
        </Field>
        <Field label="Target date">
          <DatePicker
            value={project.target_date}
            onChange={(d) => updateProject(project.id, { target_date: d })}
          />
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs text-faint">
        <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
        <span>
          {openTasks} open · {totalTasks} total{" "}
          {totalTasks === 1 ? "task" : "tasks"}
        </span>
        {project.target_date && (
          <span className="ml-auto">Target {formatDate(project.target_date)}</span>
        )}
      </div>
    </div>
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
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      {children}
    </div>
  );
}

function ProjectStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: Project["status"];
  onChange: (s: Project["status"]) => void;
  disabled?: boolean;
}) {
  const meta = PROJECT_STATUS.find((s) => s.v === value) ?? PROJECT_STATUS[0];
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <span className={meta.text}>{meta.label}</span>
      </span>
    );
  }
  return (
    <Popover
      width={150}
      align="end"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-surface-2"
        >
          <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
          <span className={meta.text}>{meta.label}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="py-1">
          {PROJECT_STATUS.map((s) => (
            <MenuItem
              key={s.v}
              active={s.v === value}
              onClick={() => {
                onChange(s.v);
                close();
              }}
            >
              <span className={cn("h-2 w-2 rounded-full", s.dot)} />
              <span className={cn("flex-1", s.text)}>{s.label}</span>
              {s.v === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (c: string) => void;
  disabled?: boolean;
}) {
  const c = PROJECT_COLORS[value] ?? PROJECT_COLORS.indigo;
  if (disabled) {
    return <span className={cn("h-3 w-3 rounded-full", c.dot)} />;
  }
  return (
    <Popover
      width={132}
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className={cn(
            "h-3.5 w-3.5 rounded-full ring-2 ring-transparent transition-all hover:ring-border",
            c.dot
          )}
          title="Project color"
        />
      )}
    >
      {(close) => (
        <div className="grid grid-cols-4 gap-1.5 p-2">
          {Object.entries(PROJECT_COLORS).map(([key, col]) => (
            <button
              key={key}
              onClick={() => {
                onChange(key);
                close();
              }}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                col.dot
              )}
              title={key}
            >
              {key === value && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
