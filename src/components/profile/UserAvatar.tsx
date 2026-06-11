import * as React from "react";
import { cn } from "@/lib/cn";

const sizeClasses = {
  xs: "h-6 w-6 text-[0.65rem]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
} as const;

export type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
};

export function getUserInitials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || "User").replace(/@.*/, "");
  const parts = source.split(/\s+|[._-]+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.charAt(0) ?? "U";
  const second = parts.length > 1 ? parts[1]?.charAt(0) : parts[0]?.charAt(1);
  return `${first}${second ?? ""}`.toUpperCase();
}

export function UserAvatar({ name, email, avatarUrl, size = "sm", className }: UserAvatarProps) {
  const label = name?.trim() || email?.trim() || "User";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-surface-2)] font-semibold text-[var(--primary)]",
        sizeClasses[size],
        className
      )}
      aria-label={`${label} profile picture`}
      title={label}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{getUserInitials(name, email)}</span>
      )}
    </span>
  );
}

export type UserIdentityProps = UserAvatarProps & {
  label?: string | null;
  sublabel?: string | null;
  trailing?: React.ReactNode;
  className?: string;
};

export function UserIdentity({ label, sublabel, trailing, className, ...avatarProps }: UserIdentityProps) {
  const primary = label?.trim() || avatarProps.name?.trim() || avatarProps.email?.trim() || "Unassigned";

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <UserAvatar {...avatarProps} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-[var(--text)]">{primary}</span>
          {trailing}
        </span>
        {sublabel ? <span className="block truncate text-xs text-[var(--text-muted)]">{sublabel}</span> : null}
      </span>
    </span>
  );
}
