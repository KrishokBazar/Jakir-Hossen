import { Profile } from '../types';

/**
 * Checks if the logged-in user has 'admin' privileges.
 * Used to restrict access to Delete buttons/triggers across the application.
 */
export function canDelete(user: Profile | null | undefined): boolean {
  return user?.role === 'admin';
}
