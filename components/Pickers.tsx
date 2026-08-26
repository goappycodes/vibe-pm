"use client";

import {
  STATUSES,
  STATUS_META,
  URGENCIES,
  URGENCY_META,
  type Status,
  type Urgency,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import { addDays, cn, TODAY, toISODate } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { MenuItem, Popover } from "./Popover";
import { Avatar } from "./Avatar";
import { DueBadge, ProjectBadge, StatusBadge, UrgencyBadge } from "./Badges";

function TriggerButton({
  children,
  className,
  toggle,
}: {
  children: React.ReactNode;
  className?: string;
  toggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent/30",
        className
      )}
    >
      {children}
    </button>
  );
}

export function StatusPicker({
  value,
  onChange,
}: {
  value: Status;
  onChange: (s: Status) => void;
}) {
  return (
    <Popover
      width={180}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          <StatusBadge status={value} />
        </TriggerButton>
      )}
    >
      {(close) => (
        <div className="py-1">
          {STATUSES.map((s) => (
            <MenuItem
              key={s}
              active={s === value}
              onClick={() => {
                onChange(s);
                close();
              }}
            >
              <span
                className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)}
              />
              <span className={cn("flex-1", STATUS_META[s].color)}>
                {STATUS_META[s].label}
              </span>
              {s === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function UrgencyPicker({
  value,
  onChange,
}: {
  value: Urgency;
  onChange: (u: Urgency) => void;
}) {
  return (
    <Popover
      width={160}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          <UrgencyBadge urgency={value} />
        </TriggerButton>
      )}
    >
      {(close) => (
        <div className="py-1">
          {URGENCIES.map((u) => (
            <MenuItem
              key={u}
              active={u === value}
              onClick={() => {
                onChange(u);
                close();
              }}
            >
              <span className="flex-1">
                <UrgencyBadge urgency={u} />
              </span>
              {u === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function AssigneePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const members = useStore((s) => s.members);
  const member = members.find((m) => m.id === value);
  return (
    <Popover
      width={220}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          <Avatar member={member} size="sm" />
          <span className="text-sm text-fg">
            {member ? member.name.split(" ")[0] : "Unassigned"}
          </span>
        </TriggerButton>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto py-1">
          <MenuItem
            active={value === null}
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint">
              <X className="h-3 w-3" />
            </span>
            <span className="flex-1 text-muted">Unassigned</span>
          </MenuItem>
          {members.map((m) => (
            <MenuItem
              key={m.id}
              active={m.id === value}
              onClick={() => {
                onChange(m.id);
                close();
              }}
            >
              <Avatar member={m} size="sm" />
              <span className="flex-1">{m.name}</span>
              {m.id === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function ProjectPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const projects = useStore((s) => s.projects);
  const project = projects.find((p) => p.id === value);
  return (
    <Popover
      width={220}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          <ProjectBadge project={project} />
        </TriggerButton>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto py-1">
          {projects.map((p) => (
            <MenuItem
              key={p.id}
              active={p.id === value}
              onClick={() => {
                onChange(p.id);
                close();
              }}
            >
              <span className="flex-1">
                <ProjectBadge project={p} />
              </span>
              {p.id === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

function nextMonday(): Date {
  const d = new Date(TODAY);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (8 - day) % 7 || 7;
  return addDays(d, diff);
}

export function DatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (d: string | null) => void;
}) {
  const presets: { label: string; date: string | null }[] = [
    { label: "Today", date: toISODate(TODAY) },
    { label: "Tomorrow", date: toISODate(addDays(TODAY, 1)) },
    { label: "In 3 days", date: toISODate(addDays(TODAY, 3)) },
    { label: "Next Monday", date: toISODate(nextMonday()) },
    { label: "In 1 week", date: toISODate(addDays(TODAY, 7)) },
  ];
  return (
    <Popover
      width={230}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          <DueBadge date={value} />
        </TriggerButton>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="py-1">
            {presets.map((p) => (
              <MenuItem
                key={p.label}
                onClick={() => {
                  onChange(p.date);
                  close();
                }}
              >
                <span className="flex-1">{p.label}</span>
                <span className="text-xs text-faint">
                  {p.date?.slice(5)}
                </span>
              </MenuItem>
            ))}
          </div>
          <div className="mt-1 border-t border-border px-1.5 pt-2">
            <input
              type="date"
              value={value ?? ""}
              onChange={(e) => {
                onChange(e.target.value || null);
              }}
              className="input py-1 text-xs"
            />
          </div>
          <div className="mt-1.5 px-1.5 pb-0.5">
            <button
              type="button"
              className="btn-ghost w-full justify-center text-xs text-muted"
              onClick={() => {
                onChange(null);
                close();
              }}
            >
              Clear date
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
