"use client";

import { useTodayPlan } from "@/lib/dayPlan";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DayPlanPicker } from "./DayPlanPicker";

/**
 * Nags on every page (except My Day, which already shows the full planner)
 * until the user has picked at least one task to work on today. Not
 * dismissable — it clears itself once a plan exists.
 */
export function DayPlanBanner() {
  const pathname = usePathname();
  const { planTasks } = useTodayPlan();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (planTasks.length > 0) return null;
  if (pathname === "/my-day") return null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 sm:px-5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          You haven&apos;t planned today&apos;s work yet.
        </span>
        <button
          onClick={() => setPickerOpen(true)}
          className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
        >
          Plan my day
        </button>
        <Link
          href="/my-day"
          className="hidden shrink-0 underline underline-offset-2 hover:no-underline sm:inline"
        >
          Go to My Day
        </Link>
      </div>
      {pickerOpen && <DayPlanPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}
