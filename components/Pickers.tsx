"use client";

import {
  PROJECT_COLORS,
  STATUSES,
  STATUS_META,
  STORY_POINTS,
  URGENCIES,
  URGENCY_META,
  type Status,
  type Urgency,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import { addDays, cn, TODAY, toISODate } from "@/lib/utils";
import { Check, Hash, Search, X } from "lucide-react";
import { useState } from "react";
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

/** A dropdown body with a filter box at the top for long lists. */
function SearchMenu<T>({
  items,
  filter,
  renderItem,
  placeholder,
  pinned,
}: {
  items: T[];
  filter: (item: T, q: string) => boolean;
  renderItem: (item: T) => React.ReactNode;
  placeholder: string;
  pinned?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query ? items.filter((i) => filter(i, query)) : items;
  return (
    <div className="py-1">
      <div className="px-1.5 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={placeholder}
            className="input py-1 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {!query && pinned}
        {shown.map(renderItem)}
        {shown.length === 0 && (
          <div className="px-2.5 py-3 text-center text-xs text-faint">
            No matches
          </div>
        )}
      </div>
    </div>
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
        <SearchMenu
          items={members}
          placeholder="Search people…"
          filter={(m, q) =>
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q)
          }
          pinned={
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
          }
          renderItem={(m) => (
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
          )}
        />
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
        <SearchMenu
          items={projects}
          placeholder="Search projects…"
          filter={(p, q) => p.name.toLowerCase().includes(q)}
          renderItem={(p) => (
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
          )}
        />
      )}
    </Popover>
  );
}

export function StoryPointsPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Popover
      width={150}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          {value == null ? (
            <span className="text-sm text-faint">— pts</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-fg">
              {value}
              <span className="text-[9px] font-medium text-faint">SP</span>
            </span>
          )}
        </TriggerButton>
      )}
    >
      {(close) => (
        <div className="py-1">
          {STORY_POINTS.map((p) => (
            <MenuItem
              key={p}
              active={p === value}
              onClick={() => {
                onChange(p);
                close();
              }}
            >
              <span className="flex-1 tabular-nums">{p} points</span>
              {p === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          ))}
          <MenuItem
            active={value == null}
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            <span className="flex-1 text-muted">Unestimated</span>
          </MenuItem>
        </div>
      )}
    </Popover>
  );
}

export function ClientPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const clients = useStore((s) => s.clients);
  const client = clients.find((c) => c.id === value);
  return (
    <Popover
      width={230}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          {client ? (
            <span className="flex items-center gap-1.5 text-sm text-fg">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  (PROJECT_COLORS[client.color] ?? PROJECT_COLORS.sky).dot
                )}
              />
              {client.name}
            </span>
          ) : (
            <span className="text-sm text-faint">Internal</span>
          )}
        </TriggerButton>
      )}
    >
      {(close) => (
        <SearchMenu
          items={clients}
          placeholder="Search clients…"
          filter={(c, q) => c.name.toLowerCase().includes(q)}
          pinned={
            <MenuItem
              active={value === null}
              onClick={() => {
                onChange(null);
                close();
              }}
            >
              <span className="h-2 w-2 rounded-full bg-faint" />
              <span className="flex-1 text-muted">Internal (no client)</span>
            </MenuItem>
          }
          renderItem={(c) => (
            <MenuItem
              key={c.id}
              active={c.id === value}
              onClick={() => {
                onChange(c.id);
                close();
              }}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  (PROJECT_COLORS[c.color] ?? PROJECT_COLORS.sky).dot
                )}
              />
              <span className="flex-1 truncate">{c.name}</span>
              {c.id === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </MenuItem>
          )}
        />
      )}
    </Popover>
  );
}

export function SlackChannelPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (name: string | null) => void;
}) {
  const channels = useStore((s) => s.settings.slack.channels);
  const connected = useStore((s) => s.settings.slack.connected);
  return (
    <Popover
      width={240}
      trigger={({ toggle }) => (
        <TriggerButton toggle={toggle}>
          {value ? (
            <span className="flex items-center gap-1 text-sm text-fg">
              <Hash className="h-3.5 w-3.5 text-faint" />
              {value}
            </span>
          ) : (
            <span className="text-sm text-faint">Link channel…</span>
          )}
        </TriggerButton>
      )}
    >
      {(close) => (
        <>
          {!connected && (
            <div className="px-2.5 pt-2 text-xs text-amber-600">
              Slack isn&apos;t connected. Connect it in Settings.
            </div>
          )}
          <SearchMenu
            items={channels}
            placeholder="Search channels…"
            filter={(ch, q) => ch.name.toLowerCase().includes(q)}
            pinned={
              <MenuItem
                active={!value}
                onClick={() => {
                  onChange(null);
                  close();
                }}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-faint">
                  <X className="h-3 w-3" />
                </span>
                <span className="flex-1 text-muted">No channel</span>
              </MenuItem>
            }
            renderItem={(ch) => (
              <MenuItem
                key={ch.id}
                active={ch.name === value}
                onClick={() => {
                  onChange(ch.name);
                  close();
                }}
              >
                <Hash className="h-3.5 w-3.5 text-faint" />
                <span className="flex-1 truncate">{ch.name}</span>
                {ch.name === value && (
                  <Check className="h-3.5 w-3.5 text-accent" />
                )}
              </MenuItem>
            )}
          />
        </>
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
