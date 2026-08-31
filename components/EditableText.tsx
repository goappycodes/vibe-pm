"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Text that saves when you're done, not on every keystroke.
 *
 * Binding an input straight to `updateTask`/`updateClient` wrote a row per
 * character — which meant an activity-log entry and a Slack post per character
 * too ("Kar — renamed to Kar", "Kary — renamed to Kary", …). This keeps a local
 * draft and commits once: on blur, on Enter, or when the field goes away.
 */
export function EditableText({
  value,
  onCommit,
  as = "input",
  rows,
  type,
  className,
  placeholder,
  disabled,
  enterCommits = as === "input",
  autoFocus,
}: {
  value: string;
  onCommit: (next: string) => void;
  as?: "input" | "textarea";
  rows?: number;
  type?: "text" | "number" | "email";
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Enter saves instead of adding a newline. Cmd/Ctrl-Enter always saves. */
  enterCommits?: boolean;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  // Refs so the unmount cleanup sees the latest values without re-running.
  const draftRef = useRef(draft);
  const valueRef = useRef(value);
  const commitRef = useRef(onCommit);
  draftRef.current = draft;
  valueRef.current = value;
  commitRef.current = onCommit;

  // Follow the stored value while someone else is the one changing it
  // (realtime edits from another window), but never mid-typing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    if (draftRef.current !== valueRef.current) commitRef.current(draftRef.current);
  };

  // A drawer closed or a row removed shouldn't silently drop the edit.
  useEffect(() => () => commit(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      // A dirty field swallows the first Escape (revert); a second one reaches
      // the panel's own handler and closes it.
      if (draftRef.current !== value) e.stopPropagation();
      // Clear the ref synchronously: Escape may unmount us this very tick,
      // and the unmount save would otherwise resurrect the discarded draft.
      draftRef.current = value;
      setDraft(value);
      setEditing(false);
      e.currentTarget.blur();
      return;
    }
    if (e.key === "Enter" && (enterCommits || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.blur(); // onBlur does the saving
    }
  };

  const shared = {
    value: draft,
    placeholder,
    disabled,
    autoFocus,
    className,
    onFocus: () => setEditing(true),
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setDraft(e.target.value),
    onBlur: () => {
      setEditing(false);
      commit();
    },
    onKeyDown,
  };

  return as === "textarea" ? (
    <textarea rows={rows} {...shared} />
  ) : (
    <input type={type ?? "text"} {...shared} />
  );
}
