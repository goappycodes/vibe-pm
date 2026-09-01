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
import type { Project } from "@/lib/types";
import { ArrowUpRight, Folder, Github, Lock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const isAdmin = currentUser?.role === "admin";
  const [dialogOpen, setDialogOpen] = useState(false);

  // open/total task counts per project, computed once.
  const counts = useMemo(() => {
    const m = new Map<string, { open: number; total: number }>();
    for (const t of tasks) {
      const c = m.get(t.project_id) ?? { open: 0, total: 0 };
      c.total += 1;
      if (t.status !== "done") c.open += 1;
      m.set(t.project_id, c);
    }
    return m;
  }, [tasks]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new")) {
      setDialogOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
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

        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Slack</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 text-right font-medium">Tasks</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {isAdmin && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  open={counts.get(p.id)?.open ?? 0}
                  total={counts.get(p.id)?.total ?? 0}
                  editable={isAdmin}
                />
              ))}
              {projects.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="px-3 py-10 text-center text-sm text-faint"
                  >
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function ProjectRow({
  project,
  open,
  total,
  editable,
}: {
  project: Project;
  open: number;
  total: number;
  editable: boolean;
}) {
  const updateProject = useStore((s) => s.updateProject);
  const removeProject = useStore((s) => s.removeProject);

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
      <td className="px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <ProjectColorPicker
            value={project.color}
            disabled={!editable}
            onChange={(color) => updateProject(project.id, { color })}
          />
          <Link
            href={`/project/${project.id}`}
            className="group flex min-w-0 items-center gap-1 font-medium text-fg hover:text-accent"
          >
            <span className="max-w-[200px] truncate">{project.name}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-accent" />
          </Link>
          {project.git_repo_url && (
            <a
              href={project.git_repo_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-faint hover:text-fg"
              title={project.git_repo_url}
            >
              <Github className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5">
        <ClientPicker
          value={project.client_id}
          onChange={(id) => updateProject(project.id, { client_id: id })}
        />
      </td>
      <td className="px-3 py-1.5">
        <AssigneePicker
          value={project.owner_id}
          onChange={(id) =>
            updateProject(project.id, { owner_id: id ?? project.owner_id })
          }
        />
      </td>
      <td className="px-3 py-1.5">
        <SlackChannelPicker
          value={project.slack_channel_id}
          onChange={(name) =>
            updateProject(project.id, { slack_channel_id: name })
          }
        />
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        <DatePicker
          value={project.target_date}
          onChange={(d) => updateProject(project.id, { target_date: d })}
        />
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted whitespace-nowrap">
        <span className="text-fg">{open}</span>
        <span className="text-faint"> / {total}</span>
      </td>
      <td className="px-3 py-1.5">
        <ProjectStatusPicker
          value={project.status}
          disabled={!editable}
          onChange={(status) => updateProject(project.id, { status })}
        />
      </td>
      {editable && (
        <td className="px-2 py-1.5">
          <button
            onClick={() => removeProject(project.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            title="Delete project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}
