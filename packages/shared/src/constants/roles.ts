export const USER_ROLES = [
  'USER',
  'MODERATOR',
  'COMPLIANCE_OFFICER',
  'ADMIN_LEAD'
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES = [
  'MODERATOR',
  'COMPLIANCE_OFFICER',
  'ADMIN_LEAD'
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

const ROLE_WEIGHT: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  COMPLIANCE_OFFICER: 2,
  ADMIN_LEAD: 3
};

export function isStaffRole(role: UserRole): role is StaffRole {
  return role !== 'USER';
}

export function hasRoleAtLeast(actual: UserRole, required: UserRole): boolean {
  return ROLE_WEIGHT[actual] >= ROLE_WEIGHT[required];
}
