"use client";

import { PROJECT_COLORS, type Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { MenuItem, Popover } from "./Popover";

export const PROJECT_STATUS: {
  v: Project["status"];
  label: string;
  dot: string;
  text: string;
}[] = [
  { v: "active", label: "Active", dot: "bg-emerald-500", text: "text-emerald-600" },
  { v: "paused", label: "Paused", dot: "bg-amber-500", text: "text-amber-600" },
  { v: "done", label: "Done", dot: "bg-slate-400", text: "text-slate-500" },
];

export function ProjectStatusPicker({
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
          type="button"
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

export function ProjectColorPicker({
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
          type="button"
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
              type="button"
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
