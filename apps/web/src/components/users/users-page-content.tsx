'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CreateManagedUserRequest,
  ManagedUser,
  ManagedUserListQuery,
  PermissionDefinition,
  RolePermissionSet,
  SystemRole,
  UserAccountStatus,
  UserManagementLookups,
} from '@unity/types';
import { SYSTEM_ROLES, USER_ACCOUNT_STATUSES } from '@unity/types';
import { hasPermission, hasRole } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createUser,
  disableUser,
  enableUser,
  fetchUserLookups,
  fetchUserRoles,
  fetchUsers,
  resetUserPassword,
  updateRolePermissions,
  updateUser,
} from '@/lib/users-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
};

function emptyForm(defaultRole: SystemRole | '') {
  return {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: defaultRole,
    instructorId: '',
  };
}

function formatLastLogin(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export function UsersPageContent() {
  const { user } = useAuth();
  const allowed = hasRole(user, 'SUPER_ADMIN', 'ADMIN') && hasPermission(user, 'users.read');
  const canManage = hasPermission(user, 'users.manage');

  const [query, setQuery] = useState<ManagedUserListQuery>({ page: 1, pageSize: 20 });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [lookups, setLookups] = useState<UserManagementLookups | null>(null);
  const [roles, setRoles] = useState<RolePermissionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm(''));
  const [formError, setFormError] = useState<string | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, string[]>>({});
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const defaultCreateRole = lookups?.creatableRoles[0] ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsers(query);
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadLookups = useCallback(async () => {
    try {
      const [nextLookups, nextRoles] = await Promise.all([fetchUserLookups(), fetchUserRoles()]);
      setLookups(nextLookups);
      setRoles(nextRoles);
      setPermissionDrafts(
        Object.fromEntries(nextRoles.map((role) => [role.name, [...role.permissions]])),
      );
    } catch {
      setLookups(null);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  useEffect(() => {
    if (!allowed) return;
    void loadLookups();
  }, [allowed, loadLookups]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of lookups?.permissions ?? []) {
      const list = groups.get(permission.resource) ?? [];
      list.push(permission);
      groups.set(permission.resource, list);
    }
    return [...groups.entries()];
  }, [lookups?.permissions]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(defaultCreateRole));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(target: ManagedUser) {
    setEditing(target);
    setForm({
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email,
      password: '',
      phone: target.phone ?? '',
      role: target.role ?? defaultCreateRole,
      instructorId: target.instructorId ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.role) {
      setFormError('Role is required');
      return;
    }

    try {
      if (editing) {
        await updateUser(editing.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          instructorId: form.instructorId || null,
        });
      } else {
        const payload: CreateManagedUserRequest = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          role: form.role,
          instructorId: form.instructorId || undefined,
        };
        await createUser(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await Promise.all([load(), loadLookups()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save user');
    }
  }

  async function handlePasswordReset() {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordError(null);
    try {
      await resetUserPassword(passwordTarget.id, { password: newPassword });
      setPasswordTarget(null);
      setNewPassword('');
      setConfirmPassword('');
      await load();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not reset password');
    }
  }

  async function handleStatusChange() {
    if (!statusTarget) return;
    try {
      if (statusTarget.status === 'ACTIVE') {
        await disableUser(statusTarget.id);
      } else {
        await enableUser(statusTarget.id);
      }
      setStatusTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user status');
      setStatusTarget(null);
    }
  }

  async function handleSavePermissions(roleName: SystemRole) {
    setPermissionError(null);
    setSavingRole(roleName);
    try {
      const updated = await updateRolePermissions(roleName, {
        permissions: permissionDrafts[roleName] ?? [],
      });
      setRoles((prev) => prev.map((role) => (role.name === roleName ? updated : role)));
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : 'Could not update permissions');
    } finally {
      setSavingRole(null);
    }
  }

  function togglePermission(roleName: string, key: string) {
    setPermissionDrafts((prev) => {
      const current = prev[roleName] ?? [];
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      return { ...prev, [roleName]: next };
    });
  }

  const roleOptions = editing ? editing.actions.assignableRoles : (lookups?.creatableRoles ?? []);

  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description="User management is available only to Super Admins and Admins."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage the three system roles. Linked instructor accounts control group access.
          </p>
        </div>
        {canManage && (lookups?.creatableRoles.length ?? 0) > 0 ? (
          <Button onClick={openCreate}>Create user</Button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
        <Input
          placeholder="Search name or email"
          value={query.search ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, page: 1, search: e.target.value || undefined }))}
        />
        <Select
          value={query.role ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              role: (e.target.value as SystemRole) || undefined,
            }))
          }
        >
          <option value="">All roles</option>
          {SYSTEM_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <Select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              status: (e.target.value as UserAccountStatus) || undefined,
            }))
          }
        >
          <option value="">All statuses</option>
          {USER_ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => setQuery({ page: 1, pageSize: 20 })}>
          Clear filters
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load users" description={error} onRetry={() => void load()} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Create a user or adjust the filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Linked Instructor</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.email}</td>
                  <td className="px-4 py-3">{item.role ? ROLE_LABELS[item.role] : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status === 'DISABLED' ? 'secondary' : 'outline'}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{item.instructorName ?? '—'}</td>
                  <td className="px-4 py-3">{formatLastLogin(item.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.actions.canUpdate ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                      ) : null}
                      {item.actions.canResetPassword ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPasswordTarget(item);
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordError(null);
                          }}
                        >
                          Reset password
                        </Button>
                      ) : null}
                      {item.actions.canDisable ? (
                        <Button variant="ghost" size="sm" onClick={() => setStatusTarget(item)}>
                          Disable
                        </Button>
                      ) : null}
                      {item.actions.canEnable ? (
                        <Button variant="ghost" size="sm" onClick={() => setStatusTarget(item)}>
                          Enable
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {meta.page} of {meta.totalPages} · {meta.total} users
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>

      {lookups?.canManagePermissions ? (
        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <h2 className="text-lg font-semibold">Role permissions</h2>
            <p className="text-sm text-muted-foreground">
              Super Admin permissions are fixed. Changes apply to Admin and Instructor roles only.
            </p>
          </div>
          {permissionError ? <p className="text-sm text-red-600">{permissionError}</p> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {roles
              .filter((role) => role.name !== 'SUPER_ADMIN')
              .map((role) => (
                <div key={role.name} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{role.displayName}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!role.canEdit || savingRole === role.name}
                      onClick={() => void handleSavePermissions(role.name)}
                    >
                      {savingRole === role.name ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {groupedPermissions.map(([resource, permissions]) => (
                      <div key={`${role.name}-${resource}`}>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{resource}</p>
                        <div className="space-y-1">
                          {permissions.map((permission) => (
                            <label key={permission.key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={(permissionDrafts[role.name] ?? []).includes(permission.key)}
                                disabled={!role.canEdit}
                                onChange={() => togglePermission(role.name, permission.key)}
                              />
                              <span>
                                {permission.action}
                                {permission.description ? (
                                  <span className="text-muted-foreground"> — {permission.description}</span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit user' : 'Create user'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update profile, role, and optional instructor link.'
              : 'Accounts start active. Instructors only see groups through a linked instructor profile.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>First name</Label>
            <Input
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Last name</Label>
            <Input
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          {!editing ? (
            <div className="space-y-1 md:col-span-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as SystemRole }))}
            >
              <option value="">Select role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Linked instructor</Label>
            <Select
              value={form.instructorId}
              onChange={(e) => setForm((prev) => ({ ...prev, instructorId: e.target.value }))}
            >
              <option value="">None</option>
              {(lookups?.instructors ?? []).map((instructor) => {
                const taken = Boolean(instructor.linkedUserId && instructor.linkedUserId !== editing?.id);
                return (
                  <option key={instructor.id} value={instructor.id} disabled={taken}>
                    {instructor.name}
                    {taken ? ' (already linked)' : ''}
                  </option>
                );
              })}
            </Select>
          </div>
          {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={
              !form.firstName.trim() ||
              !form.lastName.trim() ||
              !form.email.trim() ||
              !form.role ||
              (!editing && form.password.length < 8)
            }
          >
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(passwordTarget)} onOpenChange={() => setPasswordTarget(null)}>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {passwordTarget?.name}. Existing sessions will be signed out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPasswordTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handlePasswordReset()}>Reset password</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(statusTarget)} onOpenChange={() => setStatusTarget(null)}>
        <DialogHeader>
          <DialogTitle>{statusTarget?.status === 'ACTIVE' ? 'Disable user' : 'Enable user'}</DialogTitle>
          <DialogDescription>
            {statusTarget?.status === 'ACTIVE'
              ? `${statusTarget?.name} will no longer be able to sign in.`
              : `${statusTarget?.name} will be able to sign in again.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setStatusTarget(null)}>
            Cancel
          </Button>
          <Button onClick={() => void handleStatusChange()}>
            {statusTarget?.status === 'ACTIVE' ? 'Disable' : 'Enable'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
