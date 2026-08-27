"use client";

import { Avatar } from "@/components/Avatar";
import { useStore } from "@/lib/store";
import type { UpdateSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Send, X } from "lucide-react";
import { useMemo, useState } from "react";

const SOURCE_META: Record<
  UpdateSource,
  { label: string; className: string }
> = {
  ui: {
    label: "Dashboard",
    className:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  slack: {
    label: "Slack",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  claude: {
    label: "Claude",
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
};

export default function UpdatesPage() {
  const updates = useStore((s) => s.updates);
  const members = useStore((s) => s.members);
  const currentUserId = useStore((s) => s.currentUserId);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const addUpdate = useStore((s) => s.addUpdate);
  const removeUpdate = useStore((s) => s.removeUpdate);

  const [completed, setCompleted] = useState("");
  const [inProgress, setInProgress] = useState("");
  const [blockers, setBlockers] = useState("");

  const canPost =
    completed.trim() || inProgress.trim() || blockers.trim() ? true : false;

  const post = () => {
    const parts: string[] = [];
    if (completed.trim()) parts.push(`✅ Completed\n${completed.trim()}`);
    if (inProgress.trim()) parts.push(`🔨 In progress\n${inProgress.trim()}`);
    if (blockers.trim()) parts.push(`🚧 Blockers\n${blockers.trim()}`);
    if (!parts.length) return;
    addUpdate(parts.join("\n\n"));
    setCompleted("");
    setInProgress("");
    setBlockers("");
  };

  const sorted = useMemo(
    () =>
      [...updates].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [updates]
  );

  // group by day
  const groups = useMemo(() => {
    const map = new Map<string, typeof sorted>();
    for (const u of sorted) {
      const day = u.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(u);
    }
    return Array.from(map.entries());
  }, [sorted]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-6">
        {/* composer */}
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Avatar member={currentUser} size="sm" />
            <span className="text-sm font-medium text-fg">
              Post your daily update
            </span>
          </div>
          <div className="space-y-2">
            <Field
              label="✅ Completed"
              value={completed}
              onChange={setCompleted}
              placeholder="What did you finish?"
            />
            <Field
              label="🔨 In progress"
              value={inProgress}
              onChange={setInProgress}
              placeholder="What are you working on?"
            />
            <Field
              label="🚧 Blockers"
              value={blockers}
              onChange={setBlockers}
              placeholder="Anything blocking you?"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={post}
              disabled={!canPost}
              className="btn-primary gap-1.5 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Post update
            </button>
          </div>
        </div>

        {/* feed */}
        <div className="mt-6 space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-faint">
                {format(parseISO(day), "EEEE, MMM d")}
              </div>
              <div className="space-y-3">
                {items.map((u) => {
                  const author = members.find((m) => m.id === u.author_id);
                  const src = SOURCE_META[u.source];
                  return (
                    <div key={u.id} className="group card p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar member={author} size="sm" />
                        <span className="text-sm font-medium text-fg">
                          {author?.name ?? "Someone"}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            src.className
                          )}
                        >
                          {src.label}
                        </span>
                        <span className="text-[11px] text-faint">
                          {format(parseISO(u.created_at), "h:mm a")}
                        </span>
                        {u.author_id === currentUserId && (
                          <button
                            onClick={() => removeUpdate(u.id)}
                            className="ml-auto text-faint opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                            title="Delete update"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                        {u.raw_text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-faint">
              No updates yet. Post the first one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}
