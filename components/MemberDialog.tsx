"use client";

import { Avatar } from "@/components/Avatar";
import { MenuItem, Popover } from "@/components/Popover";
import { lookupAccount, saveAccount } from "@/lib/auth/accounts";
import { useStore } from "@/lib/store";
import { authRequired } from "@/lib/supabase/client";
import { ROLES, ROLE_META, type Role, type TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  TriangleAlert,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD =
  "w-full justify-start rounded-lg border border-border bg-surface px-2.5 py-2 text-left text-sm hover:bg-surface-2";

type Draft = {
  name: string;
  email: string;
  role: Role;
  lead_id: string | null;
  slack_user_id: string;
  timezone: string;
};

const draftOf = (m: TeamMember | null): Draft => ({
  name: m?.name ?? "",
  email: m?.email ?? "",
  role: m?.role ?? "member",
  lead_id: m?.lead_id ?? null,
  slack_user_id: m?.slack_user_id ?? "",
  timezone: m?.timezone || "Asia/Kolkata",
});

/**
 * Admin editor for one team member — the profile fields plus the two that live
 * in Supabase Auth (sign-in address and password), which go through
 * /api/admin/users because only the service role may touch them.
 *
 * `member: null` creates one, so a new member arrives with a name and an email
 * instead of appearing as an empty "New member" row the moment you click Add.
 */
export function MemberDialog({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: TeamMember | null;
  onClose: () => void;
}) {
  const members = useStore((s) => s.members);
  const addMember = useStore((s) => s.addMember);
  const updateMember = useStore((s) => s.updateMember);

  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftOf(member));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = not checked yet (or no address to check).
  const [account, setAccount] = useState<{
    exists: boolean;
    lastSignInAt: string | null;
  } | null>(null);
  // Why the lookup failed — usually a server missing the service-role key.
  const [accountError, setAccountError] = useState<string | null>(null);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  useEffect(() => setMounted(true), []);

  // Fresh state every time it opens, and ask Supabase whether this address can
  // already sign in.
  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(member));
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setSaving(false);
    setError(null);
    setAccount(null);
    setAccountError(null);
    const addr = member?.email?.trim();
    if (!authRequired || !addr) return;
    let live = true;
    void lookupAccount(addr).then((r) => {
      if (!live) return;
      if (r.ok)
        setAccount({
          exists: !!r.exists,
          lastSignInAt: r.lastSignInAt ?? null,
        });
      else setAccountError(r.error ?? "Couldn't check their sign-in account.");
    });
    return () => {
      live = false;
    };
  }, [open, member]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  if (!open || !mounted) return null;

  const name = draft.name.trim();
  const email = draft.email.trim();
  const emailChanged =
    !!member && email.toLowerCase() !== member.email.trim().toLowerCase();
  const duplicate =
    !!email &&
    members.some(
      (m) =>
        m.id !== member?.id &&
        m.email.trim().toLowerCase() === email.toLowerCase()
    );
  const badEmail = !!email && !EMAIL_RE.test(email);
  const wantsPassword = password.length > 0 || confirm.length > 0;
  const tooShort = wantsPassword && password.length < MIN_PASSWORD;
  const mismatch = wantsPassword && password !== confirm;

  const blocked =
    !name ||
    duplicate ||
    badEmail ||
    tooShort ||
    mismatch ||
    (wantsPassword && !email);

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    setError(null);

    // The member row first when creating — the auth call needs its id.
    const memberId = member?.id ?? addMember({ ...draft, name, email });

    // Auth only gets involved when the address moves or a password is set.
    if (authRequired && email && (wantsPassword || emailChanged)) {
      const res = await saveAccount({
        memberId,
        email,
        password: wantsPassword ? password : undefined,
      });
      if (!res.ok) {
        setSaving(false);
        setError(
          member
            ? res.error ?? "Couldn't update the sign-in account."
            : `Member added, but the sign-in account failed: ${
                res.error ?? "unknown error"
              }`
        );
        return;
      }
    }

    if (member) updateMember(member.id, { ...draft, name, email });
    setSaving(false);
    onClose();
  };

  const leads = members.filter(
    (m) => m.role === "team_lead" && m.id !== member?.id
  );
  const lead = members.find((m) => m.id === draft.lead_id);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-sm animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-pop animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          {member ? (
            <UserCog className="h-4 w-4 text-accent" />
          ) : (
            <UserPlus className="h-4 w-4 text-accent" />
          )}
          <h2 className="text-sm font-semibold text-fg">
            {member ? `Edit ${member.name}` : "Add team member"}
          </h2>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input
                type="text"
                autoFocus
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Full name"
                className="input"
              />
            </label>
            <label className="block">
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="name@appycodes.com"
                className="input"
              />
            </label>
          </div>

          {(duplicate || badEmail || (!email && !!member)) && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              {duplicate
                ? "Another team member already uses that email."
                : badEmail
                  ? "That doesn't look like an email address."
                  : "Without an email this member can't sign in."}
            </p>
          )}
          {emailChanged && !duplicate && !badEmail && (
            <p className="mt-1.5 text-xs text-muted">
              Their sign-in address moves with it — the old one stops working.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <FieldLabel>Role</FieldLabel>
              <Popover
                width={200}
                trigger={({ toggle }) => (
                  <button
                    onClick={toggle}
                    className={cn(FIELD, "flex items-center")}
                  >
                    <span
                      className={cn("chip", ROLE_META[draft.role].className)}
                    >
                      {ROLE_META[draft.role].label}
                    </span>
                  </button>
                )}
              >
                {(close) => (
                  <div className="py-1">
                    {ROLES.map((r) => (
                      <MenuItem
                        key={r}
                        active={r === draft.role}
                        onClick={() => {
                          patch({
                            role: r,
                            lead_id: r === "admin" ? null : draft.lead_id,
                          });
                          close();
                        }}
                      >
                        <span className={cn("chip", ROLE_META[r].className)}>
                          {ROLE_META[r].label}
                        </span>
                        {r === draft.role && (
                          <Check className="ml-auto h-3.5 w-3.5 text-accent" />
                        )}
                      </MenuItem>
                    ))}
                  </div>
                )}
              </Popover>
            </div>

            <div>
              <FieldLabel>Reports to</FieldLabel>
              {draft.role === "admin" ? (
                <div className="px-1 py-2 text-sm text-faint">
                  Admins don&apos;t report to a lead.
                </div>
              ) : (
                <Popover
                  width={240}
                  trigger={({ toggle }) => (
                    <button
                      onClick={toggle}
                      className={cn(FIELD, "flex items-center gap-1.5")}
                    >
                      {lead ? (
                        <>
                          <Avatar member={lead} size="xs" />
                          <span className="truncate text-fg">{lead.name}</span>
                        </>
                      ) : (
                        <span className="text-faint">Unassigned</span>
                      )}
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="max-h-72 overflow-y-auto py-1">
                      <MenuItem
                        active={!draft.lead_id}
                        onClick={() => {
                          patch({ lead_id: null });
                          close();
                        }}
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-faint">
                          <X className="h-3 w-3" />
                        </span>
                        <span className="text-muted">Unassigned</span>
                      </MenuItem>
                      {leads.length === 0 && (
                        <div className="px-2.5 py-2 text-xs text-faint">
                          No team leads yet.
                        </div>
                      )}
                      {leads.map((l) => (
                        <MenuItem
                          key={l.id}
                          active={l.id === draft.lead_id}
                          onClick={() => {
                            patch({ lead_id: l.id });
                            close();
                          }}
                        >
                          <Avatar member={l} size="xs" />
                          <span className="flex-1 truncate">{l.name}</span>
                          {l.id === draft.lead_id && (
                            <Check className="h-3.5 w-3.5 text-accent" />
                          )}
                        </MenuItem>
                      ))}
                    </div>
                  )}
                </Popover>
              )}
            </div>

            <label className="block">
              <FieldLabel>Slack user ID</FieldLabel>
              <input
                type="text"
                value={draft.slack_user_id}
                onChange={(e) => patch({ slack_user_id: e.target.value.trim() })}
                placeholder="U01ABC23DEF (optional)"
                className="input"
              />
            </label>
            <label className="block">
              <FieldLabel>Timezone</FieldLabel>
              <input
                type="text"
                value={draft.timezone}
                onChange={(e) => patch({ timezone: e.target.value })}
                placeholder="Asia/Kolkata"
                className="input"
              />
            </label>
          </div>

          {authRequired && (
            <div className="mt-5 rounded-xl border border-border bg-surface-2/50 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted" />
                <span className="text-sm font-medium text-fg">
                  Sign-in password
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 text-xs",
                  accountError ? "text-amber-600 dark:text-amber-400" : "text-muted"
                )}
              >
                {accountError
                  ? accountError
                  : !email
                  ? "Add an email first — the password signs them in with it."
                  : account?.exists
                    ? account.lastSignInAt
                      ? `Has an account · last signed in ${new Date(
                          account.lastSignInAt
                        ).toLocaleDateString()}. A password set here replaces theirs.`
                      : "Has an account but has never signed in. Set a password so they can."
                    : member
                      ? "No account yet. A password creates one they can use straight away — otherwise they sign in with a magic link."
                      : "Optional. Set one and they can sign in immediately; leave it blank and they use a magic link."}
              </p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    disabled={!email}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="input pr-10 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface hover:text-fg"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  disabled={!email}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void save();
                  }}
                  placeholder="Confirm password"
                  className="input disabled:opacity-50"
                />
              </div>
              {tooShort && (
                <p className="mt-2 text-xs text-muted">
                  At least {MIN_PASSWORD} characters.
                </p>
              )}
              {!tooShort && mismatch && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  The two passwords don&apos;t match.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-600">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-ghost text-sm text-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={blocked || saving}
            className="btn-primary gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {member ? "Save changes" : "Add member"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
      {children}
    </span>
  );
}
