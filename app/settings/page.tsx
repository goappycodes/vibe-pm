"use client";

import { AccountCard } from "@/components/AccountCard";
import { EditableText } from "@/components/EditableText";

import { MenuItem, Popover } from "@/components/Popover";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Check,
  Hash,
  Lock,
  Plug,
  Building2,
  Bell,
  Circle,
  CheckCircle2,
  Eye,
  Loader2,
} from "lucide-react";
import { useState } from "react";

const VIEW_OPTIONS = [
  { v: "/my-day", label: "My Day" },
  { v: "/table", label: "Table" },
  { v: "/board", label: "Board" },
  { v: "/timeline", label: "Timeline" },
];

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSlackConnected = useStore((s) => s.setSlackConnected);
  const updateSettings = useStore((s) => s.updateSettings);
  const currentUser = useStore((s) =>
    s.members.find((m) => m.id === s.currentUserId)
  );
  const isAdmin = currentUser?.role === "admin";

  const setGeneral = (patch: Partial<typeof settings.general>) =>
    updateSettings({ general: { ...settings.general, ...patch } });

  const slack = settings.slack;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-6">
        {!isAdmin && (
          <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" />
            Settings are read-only for your role.
          </div>
        )}

        {/* Slack */}
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  slack.connected
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                    : "bg-surface-2 text-faint"
                )}
              >
                <Plug className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-fg">Slack</h2>
                <p className="text-xs text-faint">
                  {slack.connected
                    ? "Board changes echo to Slack; updates flow back."
                    : "Connect your workspace to sync tasks both ways."}
                </p>
              </div>
            </div>
            {slack.connected ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-faint">
                <Circle className="h-3.5 w-3.5" />
                Not connected
              </span>
            )}
          </div>

          {slack.connected && (
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-2/50 p-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-faint">
                  Workspace
                </div>
                <div className="mt-0.5 text-sm font-medium text-fg">
                  {slack.workspace}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-faint">
                  Team
                </div>
                <div className="mt-0.5 text-sm font-medium text-fg">
                  {slack.team_name}
                </div>
              </div>
            </div>
          )}

          {slack.connected && (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-faint">
                {slack.channels.length} channels available
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slack.channels.map((ch) => (
                  <span
                    key={ch.id}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted"
                  >
                    <Hash className="h-3 w-3 text-faint" />
                    {ch.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 flex justify-end">
              {slack.connected ? (
                <button
                  onClick={() => setSlackConnected(false)}
                  className="btn-outline text-rose-600"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => setSlackConnected(true)}
                  className="btn-primary gap-1.5"
                >
                  <Plug className="h-4 w-4" />
                  Connect Slack
                </button>
              )}
            </div>
          )}
        </section>

        {/* General */}
        <section className="card mt-4 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-faint" />
            <h2 className="text-sm font-semibold text-fg">General</h2>
          </div>

          <Row label="Organization name">
            {isAdmin ? (
              <EditableText
                value={settings.general.org_name}
                onCommit={(org_name) => setGeneral({ org_name })}
                className="input max-w-xs"
              />
            ) : (
              <span className="text-sm text-fg">{settings.general.org_name}</span>
            )}
          </Row>

          <Row label="Default view">
            <Popover
              width={160}
              align="end"
              trigger={({ toggle }) => (
                <button
                  onClick={isAdmin ? toggle : undefined}
                  className={cn("btn-outline", !isAdmin && "cursor-default")}
                >
                  {VIEW_OPTIONS.find((v) => v.v === settings.general.default_view)
                    ?.label ?? "My Day"}
                </button>
              )}
            >
              {(close) => (
                <div className="py-1">
                  {VIEW_OPTIONS.map((v) => (
                    <MenuItem
                      key={v.v}
                      active={v.v === settings.general.default_view}
                      onClick={() => {
                        setGeneral({ default_view: v.v });
                        close();
                      }}
                    >
                      <span className="flex-1">{v.label}</span>
                      {v.v === settings.general.default_view && (
                        <Check className="h-3.5 w-3.5 text-accent" />
                      )}
                    </MenuItem>
                  ))}
                </div>
              )}
            </Popover>
          </Row>

          <Row label="Week starts on">
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {(["sunday", "monday"] as const).map((d) => (
                <button
                  key={d}
                  disabled={!isAdmin}
                  onClick={() => setGeneral({ week_start: d })}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm capitalize transition-colors",
                    settings.general.week_start === d
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-fg"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Timezone">
            {isAdmin ? (
              <EditableText
                value={settings.general.timezone}
                onCommit={(timezone) => setGeneral({ timezone })}
                className="input max-w-xs"
              />
            ) : (
              <span className="text-sm text-fg">{settings.general.timezone}</span>
            )}
          </Row>

          <Row label="Daily story-point goal" last>
            {isAdmin ? (
              <EditableText
                type="number"
                value={String(settings.general.min_daily_points ?? 3)}
                onCommit={(v) =>
                  setGeneral({ min_daily_points: Math.max(0, Number(v) || 0) })
                }
                className="input w-20 text-right"
              />
            ) : (
              <span className="text-sm text-fg">
                {settings.general.min_daily_points ?? 3} pts
              </span>
            )}
          </Row>
        </section>

        {isAdmin && <AlertsCard />}

        {/* every role can set their own password */}
        <AccountCard />
      </div>
    </div>
  );
}

function AlertsCard() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const alerts = settings.general.alerts ?? {};
  const enabled = alerts.enabled ?? true;

  const setAlerts = (patch: Partial<NonNullable<typeof alerts>>) =>
    updateSettings({
      general: { ...settings.general, alerts: { ...alerts, ...patch } },
    });

  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runPreview = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const r = await fetch("/api/alerts/daily?preview=1");
      const j = (await r.json()) as { text?: string; error?: string };
      setPreview(j.text ?? j.error ?? "No response.");
    } catch {
      setPreview("Could not reach the alerts service.");
    }
    setLoading(false);
  };

  return (
    <section className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-faint" />
          <div>
            <h2 className="text-sm font-semibold text-fg">Activity alerts</h2>
            <p className="text-xs text-faint">
              A daily Slack summary of yesterday, flagging long breaks and low
              active time. DM&apos;d to admins each morning.
            </p>
          </div>
        </div>
        <button
          onClick={() => setAlerts({ enabled: !enabled })}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            enabled ? "bg-accent" : "bg-surface-2 border border-border"
          )}
          aria-pressed={enabled}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all",
              enabled ? "left-[22px]" : "left-0.5"
            )}
            style={{ height: 18, width: 18 }}
          />
        </button>
      </div>

      <div className="mt-3">
        <Row label="Max lunch break">
          <div className="flex items-center gap-1.5">
            <EditableText
              type="number"
              value={String(alerts.lunch_max_min ?? 60)}
              onCommit={(v) =>
                setAlerts({ lunch_max_min: Math.max(0, Number(v) || 0) })
              }
              className="input w-20 text-right"
            />
            <span className="text-sm text-faint">min</span>
          </div>
        </Row>
        <Row label="Max tea break">
          <div className="flex items-center gap-1.5">
            <EditableText
              type="number"
              value={String(alerts.tea_max_min ?? 20)}
              onCommit={(v) =>
                setAlerts({ tea_max_min: Math.max(0, Number(v) || 0) })
              }
              className="input w-20 text-right"
            />
            <span className="text-sm text-faint">min</span>
          </div>
        </Row>
        <Row label="Min active work per day" last>
          <div className="flex items-center gap-1.5">
            <EditableText
              type="number"
              value={String(alerts.min_active_hours ?? 6.5)}
              onCommit={(v) =>
                setAlerts({ min_active_hours: Math.max(0, Number(v) || 0) })
              }
              className="input w-20 text-right"
            />
            <span className="text-sm text-faint">hours</span>
          </div>
        </Row>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-faint">
          {enabled ? "Sends daily at 9:00 AM IST." : "Alerts are turned off."}
        </span>
        <button onClick={runPreview} disabled={loading} className="btn-outline gap-1.5">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Preview yesterday
        </button>
      </div>

      {preview && (
        <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-fg">
          {preview}
        </pre>
      )}
    </section>
  );
}

function Row({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        !last && "border-b border-border"
      )}
    >
      <div className="text-sm text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}
