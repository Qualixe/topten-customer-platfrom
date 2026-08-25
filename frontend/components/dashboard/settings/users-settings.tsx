"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Check, Pencil, Trash2, UserPlus } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser, type AuthUser } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/types";
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  updateRolePermissions,
  updateUser,
  updateUserPermissions,
  type AppUser,
  type Permission,
  type Role,
} from "@/lib/api/users";

/** Every permission that exists, deduped across roles and grouped by
 * category — the shared shape both the role editor and the per-user
 * permission checklist render from. */
function groupPermissionsByCategory(roles: Role[]): Record<string, Permission[]> {
  const allPermissions = Array.from(
    new Map(roles.flatMap((role) => role.permissions).map((p) => [p.key, p])).values()
  );
  return allPermissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    (acc[permission.category] ??= []).push(permission);
    return acc;
  }, {});
}

function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "?";
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UsersSettings() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `currentUser` is fetched independently of `users`/`roles` — a viewer
  // without `users.manage` gets a 403 on the latter two, and still needs
  // their own identity resolved to know *why* (see `canManageUsers` below).
  const reload = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setCurrentUser(me);
    } catch {
      // Header already covers the logged-out case.
    }

    try {
      const [usersResult, rolesResult] = await Promise.all([listUsers(), listRoles()]);
      setUsers(usersResult.items);
      setRoles(rolesResult);
      setError(null);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((me) => {
        if (!cancelled) setCurrentUser(me);
      })
      .catch(() => {
        // Header already covers the logged-out case.
      });

    Promise.all([listUsers(), listRoles()])
      .then(([usersResult, rolesResult]) => {
        if (cancelled) return;
        setUsers(usersResult.items);
        setRoles(rolesResult);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          getErrorMessage(err, "Unable to reach the API server. Please try again.")
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canManageUsers = currentUser?.permissions.includes("users.manage") ?? false;
  const permissionsByCategory = groupPermissionsByCategory(roles);

  if (!loading && currentUser && !canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            People who can sign in to this dashboard, and what they&apos;re allowed to do.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to manage users. Ask an admin if you need access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            People who can sign in to this dashboard, and what they&apos;re allowed to do.
          </CardDescription>
          <CardAction>
            <UserFormDialog
              roles={roles}
              permissionsByCategory={permissionsByCategory}
              onSaved={reload}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                        {getInitials(user.name)}
                      </span>
                      {user.name}
                      {currentUser?.email === user.email && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role.name}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "secondary" : "outline"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <UserFormDialog
                          roles={roles}
                          permissionsByCategory={permissionsByCategory}
                          existingUser={user}
                          onSaved={reload}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.name}`}>
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <DeleteUserButton
                          user={user}
                          disabled={currentUser?.email === user.email}
                          onDeleted={reload}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RolePermissionsCard
        roles={roles}
        permissionsByCategory={permissionsByCategory}
        onSaved={reload}
      />
    </div>
  );
}

function DeleteUserButton({
  user,
  disabled,
  onDeleted,
}: {
  user: AppUser;
  disabled: boolean;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete ${user.name}? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteUser(user.id);
      onDeleted();
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to delete this user."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${user.name}`}
      disabled={disabled || deleting}
      onClick={handleDelete}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function UserFormDialog({
  roles,
  permissionsByCategory,
  existingUser,
  onSaved,
  trigger,
}: {
  roles: Role[];
  permissionsByCategory: Record<string, Permission[]>;
  existingUser?: AppUser;
  onSaved: () => void;
  trigger?: ReactElement;
}) {
  const isEdit = Boolean(existingUser);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <UserPlus />
              Add User
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this user's details, role, permissions, or password."
              : "Creates a real login for someone on your team."}
          </DialogDescription>
        </DialogHeader>

        {/* Keyed on open: each time the dialog opens, a fresh instance mounts
            with the current `existingUser` as its initial state — avoids an
            effect just to reset form fields between opens. */}
        <UserFormBody
          key={open ? (existingUser?.id ?? "new") : "closed"}
          roles={roles}
          permissionsByCategory={permissionsByCategory}
          existingUser={existingUser}
          onSaved={onSaved}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function UserFormBody({
  roles,
  permissionsByCategory,
  existingUser,
  onSaved,
  onClose,
}: {
  roles: Role[];
  permissionsByCategory: Record<string, Permission[]>;
  existingUser?: AppUser;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = Boolean(existingUser);
  const [name, setName] = useState(existingUser?.name ?? "");
  const [email, setEmail] = useState(existingUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(existingUser?.role.id ?? roles[0]?.id ?? "");
  const [isActive, setIsActive] = useState(existingUser?.isActive ?? true);
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(existingUser?.permissions ?? [])
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = roles.find((role) => role.id === roleId);

  function togglePermission(key: string, checked: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function resetPermissionsToRoleDefault() {
    setPermissions(new Set(selectedRole?.permissions.map((p) => p.key) ?? []));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && existingUser) {
        await updateUser(existingUser.id, {
          name,
          roleId,
          isActive,
          password: password || undefined,
        });
        await updateUserPermissions(existingUser.id, Array.from(permissions));
      } else {
        await createUser({ name, email, password, roleId });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField htmlFor="user-form-name" label="Name">
        <Input
          id="user-form-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </FormField>

      <FormField htmlFor="user-form-email" label="Email">
        <Input
          id="user-form-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isEdit}
          required
        />
      </FormField>

      <FormField
        htmlFor="user-form-password"
        label={isEdit ? "New Password (optional)" : "Password"}
        description={isEdit ? "Leave blank to keep their current password." : undefined}
      >
        <Input
          id="user-form-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required={!isEdit}
        />
      </FormField>

      <FormField htmlFor="user-form-role" label="Role">
        <Select value={roleId} onValueChange={(value) => setRoleId((value as string) ?? "")}>
          <SelectTrigger id="user-form-role">
            <SelectValue>
              {() => roles.find((role) => role.id === roleId)?.name ?? "Select a role"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {isEdit && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Active</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Inactive users can&apos;t sign in.
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      )}

      {isEdit && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Permissions for this person</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Starts from their role&apos;s defaults — check or uncheck anything to customize
                it for just them, without changing the role itself.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={resetPermissionsToRoleDefault}>
              Reset to role default
            </Button>
          </div>
          <PermissionChecklist
            permissionsByCategory={permissionsByCategory}
            selected={permissions}
            onToggle={togglePermission}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={submitting || !name || !roleId}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add User"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RolePermissionsCard({
  roles,
  permissionsByCategory,
  onSaved,
}: {
  roles: Role[];
  permissionsByCategory: Record<string, Permission[]>;
  onSaved: () => void;
}) {
  if (roles.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles &amp; Permissions</CardTitle>
        <CardDescription>
          What each role is allowed to do. Changes apply immediately to everyone with that role.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {roles.map((role) => (
          <RolePermissionsEditor
            key={role.id}
            role={role}
            permissionsByCategory={permissionsByCategory}
            onSaved={onSaved}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RolePermissionsEditor({
  role,
  permissionsByCategory,
  onSaved,
}: {
  role: Role;
  permissionsByCategory: Record<string, Permission[]>;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role.permissions.map((p) => p.key))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateRolePermissions(role.id, Array.from(selected));
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save permissions."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{role.name}</p>
          {role.description && (
            <p className="text-xs text-muted-foreground">{role.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <PermissionChecklist
        permissionsByCategory={permissionsByCategory}
        selected={selected}
        onToggle={toggle}
      />
    </div>
  );
}

/** The grouped-by-category checkbox grid shared by the role editor and the
 * per-user permission editor below. */
function PermissionChecklist({
  permissionsByCategory,
  selected,
  onToggle,
}: {
  permissionsByCategory: Record<string, Permission[]>;
  selected: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Object.entries(permissionsByCategory).map(([category, permissions]) => (
        <div key={category} className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {category}
          </p>
          {permissions.map((permission) => (
            <label key={permission.key} className="flex items-center gap-2 text-sm">
              <Switch
                checked={selected.has(permission.key)}
                onCheckedChange={(checked) => onToggle(permission.key, checked)}
              />
              {permission.label}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
