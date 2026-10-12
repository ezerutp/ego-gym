import { useSyncExternalStore } from 'react';

import type { Role, User } from '@/features/auth/db/users';

export type SessionUser = Pick<User, 'id' | 'name' | 'role'>;

let current: SessionUser | null = null;
let lastActivity = Date.now();
const listeners = new Set<() => void>();

function emit(next: SessionUser | null) {
  current = next;
  listeners.forEach((l) => l());
}

export const session = {
  get: () => current,
  signIn(user: SessionUser) {
    lastActivity = Date.now();
    emit({ id: user.id, name: user.name, role: user.role });
  },
  signOut: () => emit(null),
  /** Refreshes the session name/role after the signed-in user is edited. */
  update(user: SessionUser) {
    if (current?.id === user.id) emit({ id: user.id, name: user.name, role: user.role });
  },
  touch() {
    lastActivity = Date.now();
  },
  idleMs: () => Date.now() - lastActivity,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSession() {
  return useSyncExternalStore(session.subscribe, session.get);
}

export type Permission = 'manage_users' | 'manage_settings' | 'manage_plans' | 'manage_reports' | 'manage_integrations' | 'delete_records';

const RECEPTION_PERMISSIONS: Permission[] = [];

export function can(role: Role | undefined, permission: Permission) {
  if (role === 'admin') return true;
  return role === 'reception' && RECEPTION_PERMISSIONS.includes(permission);
}

export function useCan(permission: Permission) {
  return can(useSession()?.role, permission);
}
