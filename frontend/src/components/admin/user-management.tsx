"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, ShieldCheck, Trash2, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { useAuth, type AuthUser } from "@/components/layout/auth-provider";
import {
  createUser as createUserRequest,
  deleteUser as deleteUserRequest,
  listUsers,
  updateUser as updateUserRequest,
  type UserFormPayload
} from "@/features/admin/users.api";

type UserForm = UserFormPayload;

const emptyForm: UserForm = {
  username: "",
  displayName: "",
  password: "",
  role: "user",
  isApproved: true
};

export function UserManagement() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [passwordEdits, setPasswordEdits] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (user === null) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    void loadUsers();
  }, [authLoading, router, user]);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await createUserRequest(form);
      setForm(emptyForm);
      setMessage("User created.");
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create user.");
    }
  }

  async function updateUser(target: AuthUser, updates: Partial<UserForm>) {
    setError(null);
    setMessage(null);
    try {
      await updateUserRequest(target.userId, updates);
      setMessage("User updated.");
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update user.");
    }
  }

  async function deleteUser(target: AuthUser) {
    setError(null);
    setMessage(null);
    try {
      await deleteUserRequest(target.userId);
      setMessage("User deleted.");
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete user.");
    }
  }

  if (authLoading || !user || user.role !== "admin") {
    return null;
  }

  const pendingUsers = users.filter((target) => !target.isApproved);
  const approvedUsers = users.filter((target) => target.isApproved);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">Create users and control admin access.</p>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
      {message ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{message}</p> : null}
      <Panel className="space-y-4">
        <div className="flex items-center gap-3">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Add User</h2>
        </div>
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_10rem_8rem_auto]" onSubmit={createUser}>
          <Input
            placeholder="Username"
            value={form.username}
            onChange={(event) =>
              setForm((current) => ({ ...current, username: event.target.value.replace(/[^A-Za-z]/g, "") }))
            }
            pattern="[A-Za-z]+"
            required
          />
          <Input
            placeholder="Display name"
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required
          />
          <RoleSelect
            value={form.role}
            onValueChange={(role) => setForm((current) => ({ ...current, role: role as "admin" | "user" }))}
          />
          <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <input
              type="checkbox"
              checked={form.isApproved}
              onChange={(event) => setForm((current) => ({ ...current, isApproved: event.target.checked }))}
            />
            Approved
          </label>
          <Button type="submit">Create</Button>
        </form>
      </Panel>

      <Panel className="space-y-4 border-amber-500/20 bg-amber-500/5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-amber-300" />
            <div>
              <h2 className="text-lg font-semibold">Pending access requests</h2>
              <p className="text-sm text-muted-foreground">Review accounts requested from the login page.</p>
            </div>
          </div>
          <span className="w-fit rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-medium text-amber-200">
            {pendingUsers.length} pending
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading pending requests...</p>
        ) : pendingUsers.length === 0 ? (
          <p className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">
            No pending access requests.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Username</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingUsers.map((target) => (
                  <tr key={target.userId}>
                    <td className="py-3 pr-3">
                      <Input
                        value={target.displayName}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.userId === target.userId ? { ...item, displayName: event.target.value } : item
                            )
                          )
                        }
                      />
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{target.username}</td>
                    <td className="py-3 pr-3">
                      <RoleSelect
                        value={target.role}
                        onValueChange={(role) => updateUser(target, { role: role as "admin" | "user" })}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                        <Clock3 className="h-4 w-4" />
                        Under review
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateUser(target, { displayName: target.displayName, isApproved: true })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteUser(target)}>
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Approved users</h2>
            <p className="text-sm text-muted-foreground">Manage active accounts, roles, and passwords.</p>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : approvedUsers.length === 0 ? (
          <p className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">No approved users.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Username</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">New Password</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvedUsers.map((target) => (
                  <tr key={target.userId}>
                    <td className="py-3 pr-3">
                      <Input
                        value={target.displayName}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.userId === target.userId ? { ...item, displayName: event.target.value } : item
                            )
                          )
                        }
                      />
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{target.username}</td>
                    <td className="py-3 pr-3">
                      <RoleSelect
                        value={target.role}
                        onValueChange={(role) => updateUser(target, { role: role as "admin" | "user" })}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Input
                        type="password"
                        placeholder="Leave unchanged"
                        value={passwordEdits[target.userId] ?? ""}
                        onChange={(event) =>
                          setPasswordEdits((current) => ({ ...current, [target.userId]: event.target.value }))
                        }
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateUser(target, {
                              displayName: target.displayName,
                              ...(passwordEdits[target.userId] ? { password: passwordEdits[target.userId] } : {})
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteUser(target)}
                          disabled={target.userId === user.userId}
                          title={target.userId === user.userId ? "You cannot delete your own account" : "Delete user"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function RoleSelect({
  value,
  onValueChange
}: {
  value: "admin" | "user";
  onValueChange: (value: "admin" | "user") => void;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      onChange={(event) => onValueChange(event.target.value as "admin" | "user")}
    >
      <option value="admin">Admin</option>
      <option value="user">User</option>
    </select>
  );
}
