import { Profile } from '../types';

export function isAdmin(user: Profile | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase().trim();
  const phone = user.phone?.trim();
  // Strictly allow ONLY the primary administrator (Zakir/Admin) to edit or delete records
  return user.role === 'admin' 
    || email === 'ajzakir004@gmail.com' 
    || email === 'riktazhossain@gmail.com' 
    || phone === '01931355398';
}

/**
 * Checks if the logged-in user can perform edit and delete operations.
 * Strictly allow ONLY logged-in Admin accounts to change and delete records.
 */
export function canDelete(user: Profile | null | undefined): boolean {
  return isAdmin(user);
}
