"use client";
import { EditableText } from "@/components/EditableText";

import { ProjectBadge } from "@/components/Badges";
import { MenuItem, Popover } from "@/components/Popover";
import { useStore } from "@/lib/store";
import { PROJECT_COLORS, type Client } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import {
  Building2,
  Check,
  Clock,
  Lock,
  Mail,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useMemo } from "react";

export default function ClientsPage() {
  const clients = useStore((s) => s.clients);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const addClient = useStore((s) => s.addClient);
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Building2 className="h-4 w-4 text-faint" />
            {clients.length} clients
          </div>
          {isAdmin ? (
            <button onClick={() => addClient()} className="btn-primary gap-1.5">
              <Plus className="h-4 w-4" />
              New client
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-faint">
              <Lock className="h-3.5 w-3.5" />
              Only admins can manage clients
            </span>
          )}
        </div>

        <div className="space-y-3">
          {clients.map((c) => (
            <ClientCard key={c.id} client={c} editable={isAdmin} />
          ))}
          {clients.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-faint">
              No clients yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientCard({
  client,
  editable,
}: {
  client: Client;
  editable: boolean;
}) {
  const updateClient = useStore((s) => s.updateClient);
  const removeClient = useStore((s) => s.removeClient);
  const projects = useStore((s) =>
    s.projects.filter((p) => p.client_id === client.id)
  );
  const timeLogs = useStore((s) => s.timeLogs);
  // Total time logged across all of this client's projects (billing view).
  const loggedMinutes = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    return timeLogs
      .filter((l) => l.project_id && ids.has(l.project_id))
      .reduce((sum, l) => sum + l.minutes, 0);
  }, [timeLogs, projects]);
  const c = PROJECT_COLORS[client.color] ?? PROJECT_COLORS.sky;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <ColorDot
            value={client.color}
            disabled={!editable}
            onChange={(color) => updateClient(client.id, { color })}
          />
          <span className="truncate text-base font-semibold text-fg">
            {client.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={!editable}
            onClick={() =>
              updateClient(client.id, {
                status: client.status === "active" ? "archived" : "active",
              })
            }
            className={cn(
              "chip",
              client.status === "active"
                ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-transparent bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
              editable && "cursor-pointer hover:opacity-80"
            )}
          >
            {client.status === "active" ? "Active" : "Archived"}
          </button>
          {editable && (
            <button
              onClick={() => removeClient(client.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              title="Delete client"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
            <User className="h-3 w-3" /> Contact
          </div>
          {editable ? (
            <EditableText
              value={client.contact_name}
              placeholder="Contact name"
              onCommit={(contact_name) =>
                updateClient(client.id, { contact_name })
              }
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-fg outline-none hover:border-border focus:border-accent focus:bg-surface-2"
            />
          ) : (
            <div className="px-1.5 text-sm text-fg">
              {client.contact_name || "—"}
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
            <Mail className="h-3 w-3" /> Email
          </div>
          {editable ? (
            <EditableText
              type="email"
              value={client.contact_email}
              placeholder="name@client.com"
              onCommit={(contact_email) =>
                updateClient(client.id, { contact_email })
              }
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-muted outline-none hover:border-border focus:border-accent focus:bg-surface-2"
            />
          ) : (
            <div className="px-1.5 text-sm text-muted">
              {client.contact_email || "—"}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-faint">
          {projects.length} {projects.length === 1 ? "project" : "projects"}:
        </span>
        {projects.map((p) => (
          <ProjectBadge key={p.id} project={p} />
        ))}
        {projects.length === 0 && (
          <span className="text-xs text-faint">none assigned yet</span>
        )}
        {loggedMinutes > 0 && (
          <span
            className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted"
            title="Time logged across this client's projects"
          >
            <Clock className="h-3.5 w-3.5 text-faint" />
            {formatDuration(loggedMinutes)} logged
          </span>
        )}
      </div>
    </div>
  );
}

function ColorDot({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (c: string) => void;
  disabled?: boolean;
}) {
  const c = PROJECT_COLORS[value] ?? PROJECT_COLORS.sky;
  if (disabled) return <span className={cn("h-3 w-3 rounded-full", c.dot)} />;
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
          title="Client color"
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
