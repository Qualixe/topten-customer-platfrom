import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope } from "@/lib/api/types";

export interface Permission {
  key: string;
  label: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** This user's role permissions with their individual overrides applied
   * — not the same as `role.permissions`, which is the role's own
   * unmodified default set. */
  permissions: string[];
}

export interface ListUsersResult {
  items: AppUser[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listUsers(page: number = 1, pageSize: number = 50): Promise<ListUsersResult> {
  const query = buildQueryString({ page, page_size: pageSize });
  const envelope = await apiGet<ApiListEnvelope<AppUser>>(`/users${query}`);
  return {
    items: envelope.data,
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roleId: string;
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  const envelope = await apiPost<ApiEnvelope<AppUser>>("/users", {
    email: input.email,
    password: input.password,
    name: input.name,
    role_id: input.roleId,
  });
  return envelope.data;
}

export interface UpdateUserInput {
  name?: string;
  roleId?: string;
  isActive?: boolean;
  password?: string;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AppUser> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.roleId !== undefined) body.role_id = input.roleId;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  if (input.password !== undefined) body.password = input.password;

  const envelope = await apiPatch<ApiEnvelope<AppUser>>(`/users/${id}`, body);
  return envelope.data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiDelete<void>(`/users/${id}`);
}

/** Sets this user's *individual* permission overrides — pass the full
 * desired effective set (their role's defaults plus/minus whatever's
 * different for just them), not a delta. Only what actually differs from
 * their role is stored, so other people with the same role are untouched. */
export async function updateUserPermissions(
  id: string,
  permissionKeys: string[]
): Promise<AppUser> {
  const envelope = await apiPatch<ApiEnvelope<AppUser>>(`/users/${id}/permissions`, {
    permission_keys: permissionKeys,
  });
  return envelope.data;
}

export async function listRoles(): Promise<Role[]> {
  const envelope = await apiGet<ApiListEnvelope<Role>>("/roles");
  return envelope.data;
}

export async function updateRolePermissions(id: string, permissionKeys: string[]): Promise<Role> {
  const envelope = await apiPatch<ApiEnvelope<Role>>(`/roles/${id}`, {
    permission_keys: permissionKeys,
  });
  return envelope.data;
}
