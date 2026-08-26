"use client";

import type { TeamMember } from "@/lib/types";
import { avatarTone, cn, initials } from "@/lib/utils";

const SIZES: Record<string, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-[11px]",
  lg: "h-9 w-9 text-sm",
};

export function Avatar({
  member,
  size = "sm",
  className,
  ring = false,
}: {
  member: TeamMember | undefined | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  if (!member) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-surface-2 text-faint border border-border",
          SIZES[size],
          className
        )}
        title="Unassigned"
      >
        ?
      </span>
    );
  }
  return (
    <span
      title={member.name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white select-none",
        avatarTone(member),
        SIZES[size],
        ring && "ring-2 ring-surface",
        className
      )}
    >
      {initials(member.name)}
    </span>
  );
}

export function AvatarStack({
  members,
  max = 3,
  size = "sm",
}: {
  members: (TeamMember | undefined)[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((m, i) => (
        <Avatar key={m?.id ?? i} member={m} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted ring-2 ring-surface border border-border",
            SIZES[size]
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
