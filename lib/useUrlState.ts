"use client";

import { useCallback, useEffect, useState } from "react";

// Small URL-query state helper so in-page navigation and filters live in the URL
// — Back/Forward works and views are shareable. Built on window.history +
// popstate to match the existing ?task= drawer sync in AppShell (and to avoid
// Next's useSearchParams suspense-boundary requirement).
//
// history: "push" adds a Back entry (use for navigation, e.g. opening a person);
//          "replace" updates the URL in place (use for filters — no Back spam).

type HistoryMode = "push" | "replace";

function currentSearch(): string {
  return typeof window !== "undefined" ? window.location.search : "";
}

export function useUrlParams() {
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => {
    const on = () => setSearch(window.location.search);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  const get = useCallback(
    (key: string, def = ""): string =>
      new URLSearchParams(search).get(key) ?? def,
    [search]
  );

  // Apply one or more param changes in a single history entry. A null/empty
  // value removes the key. Reads live location so it composes with other writers
  // (e.g. AppShell's ?task=).
  const set = useCallback(
    (
      patch: Record<string, string | null | undefined>,
      history: HistoryMode = "replace"
    ) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : "");
      if (history === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
      setSearch(window.location.search);
    },
    []
  );

  return { get, set };
}

/** Single-key convenience: `[value, setValue]`, defaulting to replace-history. */
export function useQueryState(
  key: string,
  def = "",
  history: HistoryMode = "replace"
): [string, (v: string) => void] {
  const { get, set } = useUrlParams();
  const value = get(key, def);
  const setValue = useCallback(
    (v: string) => set({ [key]: v === def ? null : v }, history),
    [set, key, def, history]
  );
  return [value, setValue];
}
