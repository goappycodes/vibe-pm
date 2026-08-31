"use client";

import { NewProjectDialog } from "@/components/NewProjectDialog";
import {
  AssigneePicker,
  ClientPicker,
  DatePicker,
  SlackChannelPicker,
} from "@/components/Pickers";
import {
  ProjectColorPicker,
  ProjectStatusPicker,
} from "@/components/ProjectPickers";
import { useStore } from "@/lib/store";
import { PROJECT_COLORS, type Project } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { ArrowUpRight, Folder, Lock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const isAdmin = currentUser?.role === "admin";
  const [dialogOpen, setDialogOpen] = useState(false);

  // The command palette's "Create project" lands here with ?new=1.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new")) {
      setDialogOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Folder className="h-4 w-4 text-faint" />
            {projects.length} projects
          </div>
          {isAdmin ? (
            <button
              onClick={() => setDialogOpen(true)}
              className="btn-primary gap-1.5"
            >
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

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
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
          <ProjectColorPicker
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
