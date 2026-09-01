import { useEffect, useMemo } from "react";
import { ArrowLeft, Coffee, RefreshCw } from "lucide-react";
import { useStore } from "../lib/store";
import { fmtDate, fmtDuration } from "../lib/time";
import type { TimeEntry } from "../lib/types";

export function EntriesView({ onBack }: { onBack: () => void }) {
  const entries = useStore((s) => s.entries);
  const loading = useStore((s) => s.entriesLoading);
  const loadEntries = useStore((s) => s.loadEntries);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const groups = useMemo(() => {
    const byDate = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return Array.from(byDate.entries()).map(([date, list]) => {
      const workMin = list
        .filter((e) => e.kind === "work")
        .reduce((s, e) => s + e.minutes, 0);
      const breakMin = list
        .filter((e) => e.kind === "break")
        .reduce((s, e) => s + e.minutes, 0);
      return { date, list, workMin, breakMin };
    });
  }, [entries]);

  return (
    <div className="screen">
      <div className="picker-head">
        <button className="icon-btn" onClick={onBack} title="Back">
          <ArrowLeft className="icon" />
        </button>
        <div style={{ flex: 1 }}>
          <h1>My time entries</h1>
          <p className="muted small">Everything you’ve tracked, most recent first.</p>
        </div>
        <button
          className="icon-btn"
          onClick={() => void loadEntries()}
          title="Refresh"
        >
          <RefreshCw className={`icon ${loading ? "spin" : ""}`} />
        </button>
      </div>

      <div className="grow task-list" style={{ marginTop: 8 }}>
        {loading && entries.length === 0 && (
          <p className="faint small" style={{ textAlign: "center", padding: "28px 0" }}>
            Loading…
          </p>
        )}
        {!loading && entries.length === 0 && (
          <p className="faint small" style={{ textAlign: "center", padding: "28px 0" }}>
            No time entries yet. Start a timer to log your first one.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.date} style={{ marginBottom: 6 }}>
            <div className="entry-day">
              <span className="section-label" style={{ margin: 0 }}>
                {fmtDate(g.date)}
              </span>
              <span className="faint small">
                {fmtDuration(g.workMin)} worked
                {g.breakMin > 0 && ` · ${fmtDuration(g.breakMin)} break`}
              </span>
            </div>
            {g.list.map((e) => (
              <div
                key={e.id}
                className={`entry ${e.kind === "break" ? "is-break" : ""}`}
              >
                {e.kind === "break" && (
                  <Coffee
                    className="icon"
                    style={{ color: "var(--amber)", width: 14, height: 14 }}
                  />
                )}
                <span className="entry-title">{e.title}</span>
                <span className="entry-time faint">
                  {e.start_time}–{e.end_time}
                </span>
                <span className="entry-dur">{fmtDuration(e.minutes)}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
