/**
 * Helpers to read the current user's identity from the shared auth storage
 * used by AgricultureFront's AuthService (key: 'authUser').
 *
 * The delivery module was originally standalone and kept role/id/email in
 * separate localStorage keys ('role', 'userRole', 'currentUserId', ...).
 * After integration into AgricultureFront these helpers bridge the gap
 * without touching any code outside the delivery module.
 */

interface StoredAuthUser {
  userId: number;
  username: string;
  email: string;
  role?: string;
  roles?: string[];
}

function readAuthUser(): StoredAuthUser | null {
  const raw = localStorage.getItem('authUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuthUser;
  } catch {
    return null;
  }
}

/** Returns the current user's role as a lowercase string (e.g. 'agriculteur', 'transporteur', 'admin'). */
export function getDeliveryUserRole(): string {
  const authUser = readAuthUser();
  const authRole = authUser?.role;
  if (authRole && typeof authRole === 'string') {
    return authRole.trim().toLowerCase();
  }

  const authRoles = authUser?.roles;
  if (Array.isArray(authRoles) && authRoles.length > 0) {
    return String(authRoles[0]).trim().toLowerCase();
  }

  const roleFallback = localStorage.getItem('userRole') || localStorage.getItem('role');
  return roleFallback?.trim().toLowerCase() || 'client';
}

/** Returns the current user's numeric id, or null if not logged in. */
export function getDeliveryUserId(): number | null {
  const user = readAuthUser();
  return user?.userId ?? null;
}

/** Returns the current user's email, lower-cased. Falls back to 'unknown@local'. */
export function getDeliveryUserEmail(): string {
  return readAuthUser()?.email?.toLowerCase() ?? 'unknown@local';
}
