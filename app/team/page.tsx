"use client";
import { EditableText } from "@/components/EditableText";

import { Avatar } from "@/components/Avatar";
import { MenuItem, Popover } from "@/components/Popover";
import { useStore } from "@/lib/store";
import {
  ROLES,
  ROLE_META,
  type Role,
  type TeamMember,
} from "@/lib/types";
import { cn, daysFromToday } from "@/lib/utils";
import { Check, Lock, Plus, ShieldCheck, Trash2, UserCog, Users2, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const COLS =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_128px_190px_36px] items-center gap-3";

const ROLE_RANK: Record<Role, number> = { admin: 0, team_lead: 1, member: 2 };

export default function TeamPage() {
  const members = useStore((s) => s.members);
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const addMember = useStore((s) => s.addMember);

  const isAdmin = currentUser?.role === "admin";

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      const r = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      if (r !== 0) return r;
      const la = a.lead_id ?? "";
      const lb = b.lead_id ?? "";
      if (la !== lb) return la.localeCompare(lb);
      return a.name.localeCompare(b.name);
    });
  }, [members]);

  const counts = useMemo(
    () => ({
      total: members.length,
      admins: members.filter((m) => m.role === "admin").length,
      leads: members.filter((m) => m.role === "team_lead").length,
      members: members.filter((m) => m.role === "member").length,
    }),
    [members]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-6">
            <Stat icon={<Users2 className="h-4 w-4" />} label="Members" value={counts.total} />
            <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Admins" value={counts.admins} />
            <Stat icon={<UserCog className="h-4 w-4" />} label="Team leads" value={counts.leads} />
          </div>
          {isAdmin ? (
            <button
              onClick={() => addMember()}
              className="btn-primary gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add member
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-faint">
              <Lock className="h-3.5 w-3.5" />
              Only admins can manage the team
            </span>
          )}
        </div>

        <div className="card overflow-hidden">
          <div
            className={cn(
              COLS,
              "border-b border-border bg-surface-2/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint"
            )}
          >
            <span>Member</span>
            <span>Email</span>
            <span>Role</span>
            <span>Reports to</span>
            <span />
          </div>

          {sorted.map((m) => {
            const mine = tasks.filter(
              (t) => t.assignee_id === m.id && t.status !== "done"
            );
            const overdue = mine.filter((t) => {
              const d = daysFromToday(t.due_date);
              return d !== null && d < 0;
            }).length;
            return (
              <MemberRow
                key={m.id}
                member={m}
                editable={isAdmin}
                isSelf={m.id === currentUser?.id}
                openTasks={mine.length}
                overdue={overdue}
              />
            );
          })}
        </div>

        <p className="mt-3 px-1 text-xs text-faint">
          Roles: <span className="font-medium text-muted">Admin</span> manages
          the team ·{" "}
          <span className="font-medium text-muted">Team lead</span> owns a group
          of members · <span className="font-medium text-muted">Member</span>{" "}
          reports to a team lead.
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-faint">{icon}</span>
      <span className="text-lg font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

function MemberRow({
  member,
  editable,
  isSelf,
  openTasks,
  overdue,
}: {
  member: TeamMember;
  editable: boolean;
  isSelf: boolean;
  openTasks: number;
  overdue: number;
}) {
  const updateMember = useStore((s) => s.updateMember);
  const removeMember = useStore((s) => s.removeMember);

  return (
    <div
      className={cn(
        COLS,
        "border-b border-border/60 px-4 py-2 transition-colors hover:bg-surface"
      )}
    >
      {/* name */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href={`/member/${member.id}`}
          title="View workload"
          className="shrink-0 rounded-full ring-2 ring-transparent transition-all hover:ring-accent/40"
        >
          <Avatar member={member} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/member/${member.id}`}
            className="block truncate px-1.5 text-sm font-medium text-fg hover:text-accent"
          >
            {member.name}
          </Link>
          <div className="px-1.5 text-[11px] text-faint">
            {openTasks} open {openTasks === 1 ? "task" : "tasks"}
            {overdue > 0 && (
              <span className="font-medium text-rose-600 dark:text-rose-400">
                {" "}
                · {overdue} overdue
              </span>
            )}
            {isSelf && " · you"}
          </div>
        </div>
      </div>

      {/* email */}
      {editable ? (
        <EditableText
          type="email"
          value={member.email}
          placeholder="name@appycodes.com"
          onCommit={(email) => updateMember(member.id, { email })}
          className="w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-muted outline-none hover:border-border focus:border-accent focus:bg-surface-2"
        />
      ) : (
        <div className="truncate px-1.5 text-sm text-muted">
          {member.email || "—"}
        </div>
      )}

      {/* role */}
      <RolePicker
        value={member.role}
        disabled={!editable}
        onChange={(role) => updateMember(member.id, { role })}
      />

      {/* reports to */}
      <LeadPicker member={member} disabled={!editable} />

      {/* remove */}
      {editable && !isSelf ? (
        <button
          onClick={() => removeMember(member.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
          title="Remove member"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (r: Role) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className={cn("chip w-fit", ROLE_META[value].className)}>
        {ROLE_META[value].label}
      </span>
    );
  }
  return (
    <Popover
      width={170}
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="w-fit rounded-md p-0.5 hover:opacity-80"
        >
          <span className={cn("chip", ROLE_META[value].className)}>
            {ROLE_META[value].label}
          </span>
        </button>
      )}
    >
      {(close) => (
        <div className="py-1">
          {ROLES.map((r) => (
            <MenuItem
              key={r}
              active={r === value}
              onClick={() => {
                onChange(r);
                close();
              }}
            >
              <span className={cn("chip", ROLE_META[r].className)}>
                {ROLE_META[r].label}
              </span>
              {r === value && (
                <Check className="ml-auto h-3.5 w-3.5 text-accent" />
              )}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

function LeadPicker({
  member,
  disabled,
}: {
  member: TeamMember;
  disabled?: boolean;
}) {
  const members = useStore((s) => s.members);
  const updateMember = useStore((s) => s.updateMember);
  const leads = members.filter(
    (m) => m.role === "team_lead" && m.id !== member.id
  );
  const lead = members.find((m) => m.id === member.lead_id);

  if (member.role === "admin") {
    return <span className="px-1.5 text-sm text-faint">—</span>;
  }

  if (disabled) {
    return lead ? (
      <span className="flex items-center gap-1.5 px-1.5 text-sm text-fg">
        <Avatar member={lead} size="xs" />
        {lead.name}
      </span>
    ) : (
      <span className="px-1.5 text-sm text-faint">Unassigned</span>
    );
  }

  return (
    <Popover
      width={230}
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-surface-2"
        >
          {lead ? (
            <>
              <Avatar member={lead} size="xs" />
              <span className="truncate text-fg">{lead.name}</span>
            </>
          ) : (
            <span className="text-faint">Unassigned</span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto py-1">
          <MenuItem
            active={!member.lead_id}
            onClick={() => {
              updateMember(member.id, { lead_id: null });
              close();
            }}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-faint">
              <X className="h-3 w-3" />
            </span>
            <span className="text-muted">Unassigned</span>
          </MenuItem>
          {leads.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-faint">
              No team leads yet. Set someone&apos;s role to Team lead first.
            </div>
          )}
          {leads.map((l) => (
            <MenuItem
              key={l.id}
              active={l.id === member.lead_id}
              onClick={() => {
                updateMember(member.id, { lead_id: l.id });
                close();
              }}
            >
              <Avatar member={l} size="xs" />
              <span className="flex-1 truncate">{l.name}</span>
              {l.id === member.lead_id && (
                <Check className="h-3.5 w-3.5 text-accent" />
              )}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
