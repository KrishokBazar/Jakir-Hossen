import { Profile } from '../types';

/**
 * Checks if the logged-in user can perform edit and delete operations.
 * As requested, Admin, Operators, Employees, and Customers can all edit and delete data.
 */
export function canDelete(user: Profile | null | undefined): boolean {
  // Allow all logged-in profiles/users (Admins, Operators, Cofounders, Employees, and Customers) to delete and edit data.
  return !!user;
}
