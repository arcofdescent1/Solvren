"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Input,
  Button,
  Card,
  CardBody,
  NativeSelect,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui";
import { MoreHorizontal } from "lucide-react";

const ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "submitter", label: "Submitter" },
  { value: "reviewer", label: "Reviewer" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const;

type OrgMember = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: "Active" | "Unverified";
  joined_at: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_email?: string | null;
};

type Props = {
  orgId: string;
  orgName: string | null;
  currentUserId: string;
};

export default function UsersManagement({ orgId, orgName, currentUserId }: Props) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ member: OrgMember } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{ invite: PendingInvite } | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ member: OrgMember; newRole: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setInviteMsg(null);
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const loadMembers = useCallback(() => {
    setMembersLoading(true);
    fetch(`/api/org/members?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data.members) ? data.members : []))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [orgId]);

  const loadInvites = useCallback(() => {
    setInvitesLoading(true);
    fetch(`/api/org/invites?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((data) => setInvites(Array.isArray(data.invites) ? data.invites : []))
      .catch(() => setInvites([]))
      .finally(() => setInvitesLoading(false));
  }, [orgId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);
  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isLastOwner = (m: OrgMember) => m.role === "owner" && ownerCount <= 1;
  const canChangeRole = (m: OrgMember) => !isLastOwner(m);
  const canRemove = (m: OrgMember) => !isLastOwner(m);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setInviteMsg("Enter an email address.");
      return;
    }
    setInviteLoading(true);
    const res = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, role, orgId }),
    });
    const data = await res.json().catch(() => ({}));
    setInviteLoading(false);
    if (res.ok) {
      showSuccess("Invite sent. They'll receive an email with a link to join.");
      setEmail("");
      loadInvites();
    } else {
      setInviteMsg((data as { error?: string }).error ?? "Failed to send invite.");
    }
  }

  async function revokeInvite(invite: PendingInvite) {
    setConfirmRevoke(null);
    setActionLoading(true);
    const res = await fetch("/api/org/invites/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: invite.id }),
    });
    setActionLoading(false);
    if (res.ok) {
      showSuccess("Invite revoked.");
      loadInvites();
    }
  }

  async function resendInvite(invite: PendingInvite) {
    setActionLoading(true);
    const res = await fetch(`/api/org/invites/${encodeURIComponent(invite.id)}/resend`, { method: "POST" });
    setActionLoading(false);
    if (res.ok) {
      showSuccess("Invite resent.");
      loadInvites();
    }
  }

  async function changeMemberRole(member: OrgMember, newRole: string) {
    setConfirmRole(null);
    setActionLoading(true);
    const res = await fetch(`/api/org/members/${encodeURIComponent(member.user_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setActionLoading(false);
    if (res.ok) {
      showSuccess("Role updated.");
      loadMembers();
    }
  }

  async function removeMember(member: OrgMember) {
    setConfirmRemove(null);
    setActionLoading(true);
    const res = await fetch(`/api/org/members/${encodeURIComponent(member.user_id)}`, { method: "DELETE" });
    setActionLoading(false);
    if (res.ok) {
      showSuccess("Member removed from organization.");
      loadMembers();
    }
  }

  const displayName = (m: OrgMember) => m.name?.trim() || m.email || "—";
  const displayDate = (s: string) => (s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

  return (
    <>
      {successMsg && (
        <p className="rounded-md border border-[var(--success)] bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--text)]">
          {successMsg}
        </p>
      )}

      {/* Section 1 — Members */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-semibold">Members</h2>
          {membersLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No other members yet. Invite teammates to start collaborating.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <span className="font-medium">{displayName(m)}</span>
                      {m.user_id === currentUserId && (
                        <Badge variant="secondary" className="ml-2">
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">{m.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLES.find((r) => r.value === m.role)?.label ?? m.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === "Active" ? "success" : "secondary"}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">{displayDate(m.joined_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canChangeRole(m)}
                            onClick={() => setConfirmRole({ member: m, newRole: m.role })}
                          >
                            Change role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canRemove(m)}
                            onClick={() => setConfirmRemove({ member: m })}
                            className="text-[var(--danger)]"
                          >
                            Remove from organization
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Section 2 — Pending Invites */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-semibold">Pending invites</h2>
          {invitesLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No pending invites.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLES.find((r) => r.value === inv.role)?.label ?? inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">{inv.invited_by_email ?? "—"}</TableCell>
                    <TableCell className="text-[var(--text-muted)]">{displayDate(inv.created_at)}</TableCell>
                    <TableCell className="text-[var(--text-muted)]">{displayDate(inv.expires_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => resendInvite(inv)} disabled={!!actionLoading}>
                            Resend invite
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmRevoke({ invite: inv })}
                            className="text-[var(--danger)]"
                            disabled={!!actionLoading}
                          >
                            Revoke invite
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Section 3 — Invite User */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-semibold">Invite user</h2>
          <form onSubmit={submitInvite} className="flex flex-col gap-3">
            <Input
              placeholder="teammate@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Role</label>
              <NativeSelect value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" disabled={inviteLoading}>
              {inviteLoading ? "Sending…" : "Send invite"}
            </Button>
            {inviteMsg && <p className="text-sm text-[var(--danger)]">{inviteMsg}</p>}
          </form>
        </CardBody>
      </Card>

      {/* Confirm Remove Member */}
      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from organization?</DialogTitle>
            <DialogDescription>
              Remove {confirmRemove ? displayName(confirmRemove.member) : ""} from {orgName ?? "this organization"}? They will
              lose access to this organization immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-[var(--danger)] hover:bg-[var(--danger)]/90"
              disabled={!!actionLoading}
              onClick={() => confirmRemove && removeMember(confirmRemove.member)}
            >
              Remove from organization
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Revoke Invite */}
      <Dialog open={!!confirmRevoke} onOpenChange={(open) => !open && setConfirmRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invite?</DialogTitle>
            <DialogDescription>
              Revoke the invite for {confirmRevoke?.invite.email ?? ""}? They will no longer be able to use this link to join.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-[var(--danger)] hover:bg-[var(--danger)]/90"
              disabled={!!actionLoading}
              onClick={() => confirmRevoke && revokeInvite(confirmRevoke.invite)}
            >
              Revoke invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Role */}
      <Dialog open={!!confirmRole} onOpenChange={(open) => !open && setConfirmRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Set a new role for {confirmRole ? displayName(confirmRole.member) : ""}. Role changes take effect immediately.
              {confirmRole?.newRole === "admin" && " Admin can manage members and org settings."}
              {confirmRole?.newRole === "owner" && " Owners have full organization control."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <label className="block text-sm font-medium">Role</label>
            <NativeSelect
              value={confirmRole?.newRole ?? "viewer"}
              onChange={(e) => confirmRole && setConfirmRole({ ...confirmRole, newRole: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmRole(null)}>
              Cancel
            </Button>
            <Button
              disabled={!!actionLoading || !confirmRole || confirmRole.newRole === confirmRole.member.role}
              onClick={() => {
                if (confirmRole && confirmRole.newRole !== confirmRole.member.role) {
                  changeMemberRole(confirmRole.member, confirmRole.newRole);
                }
              }}
            >
              Update role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
