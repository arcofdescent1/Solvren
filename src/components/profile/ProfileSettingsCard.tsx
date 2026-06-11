"use client";

import * as React from "react";
import { Camera, Upload } from "lucide-react";
import { Button, Card, CardBody, Input } from "@/ui";
import { UserAvatar } from "@/components/profile/UserAvatar";

type Props = {
  initialDisplayName?: string | null;
  initialEmail?: string | null;
  initialAvatarUrl?: string | null;
};

type UploadState = "idle" | "resizing" | "saving";

async function resizeAvatar(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read image."));
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to resize image.");

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.floor((image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.floor((image.naturalHeight - sourceSize) / 2);
    ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 256, 256);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Unable to encode image."))), "image/webp", 0.9);
    });
    return new File([blob], "avatar.webp", { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function ProfileSettingsCard({ initialDisplayName, initialEmail, initialAvatarUrl }: Props) {
  const [displayName, setDisplayName] = React.useState(initialDisplayName ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatarUrl ?? null);
  const [state, setState] = React.useState<UploadState>("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setMessage(null);
    setState("resizing");
    try {
      const resized = await resizeAvatar(file);
      setState("saving");
      const form = new FormData();
      form.append("file", resized);
      form.append("displayName", displayName.trim());
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string; profile?: { avatarUrl?: string | null } };
      if (!res.ok) {
        const demoBlocked = res.status === 403 && data.error === "Demo mode is read-only";
        throw new Error(demoBlocked ? "Demo profile uploads are not enabled yet. Please try again after the latest update deploys." : data.error ?? "Unable to save profile picture.");
      }
      setAvatarUrl(data.profile?.avatarUrl ?? null);
      setMessage("Profile picture updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile picture.");
    } finally {
      setState("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveProfile() {
    setMessage(null);
    setState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const demoBlocked = res.status === 403 && data.error === "Demo mode is read-only";
        throw new Error(demoBlocked ? "Demo profile updates are not enabled yet. Please try again after the latest update deploys." : data.error ?? "Unable to save profile.");
      }
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setState("idle");
    }
  }

  const busy = state !== "idle";

  return (
    <Card className="border-[var(--primary)]/20">
      <CardBody className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative">
            <UserAvatar name={displayName} email={initialEmail} avatarUrl={avatarUrl} size="lg" />
            <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--primary)] shadow-sm">
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Your profile</p>
              <h2 className="mt-1 text-lg font-semibold">Make assignments feel human.</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Your picture and name appear beside approvals, owners, and team member lists.
              </p>
            </div>
            <div className="max-w-md">
              <label className="mb-1 block text-sm font-medium" htmlFor="profile-display-name">
                Display name
              </label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={initialEmail ?? "Your name"}
                autoComplete="name"
              />
            </div>
            {message ? <p className="text-sm text-[var(--text-muted)]">{message}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" aria-hidden />
            {state === "resizing" ? "Resizing..." : state === "saving" ? "Saving..." : "Upload picture"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void saveProfile()} disabled={busy || !displayName.trim()}>
            Save profile
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
