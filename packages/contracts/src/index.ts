export const platformRoles = [
  'organization_admin',
  'principal',
  'finance_admin',
  'project_manager',
  'project_member',
  'field_supervisor',
  'contractor',
  'consultant',
  'owner',
  'vendor',
] as const;

export type PlatformRole = (typeof platformRoles)[number];
export type ThemePreference = 'light' | 'dark' | 'system';

export interface AuthenticatedActor {
  userId: string;
  organizationId: string;
  roles: PlatformRole[];
  displayName?: string;
  email?: string;
}
