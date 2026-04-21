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
  role: string;
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
  return readAuthUser()?.role?.toLowerCase() ?? 'client';
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
