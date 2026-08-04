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

export const taskWorkflow = {
  open: { label: 'Open', next: 'in_progress', action: 'Start progress' },
  in_progress: { label: 'In Progress', next: 'in_acceptance', action: 'Send to acceptance' },
  in_acceptance: { label: 'In Acceptance', next: 'done', action: 'Mark done' },
  done: { label: 'Done', next: 'open', action: 'Reopen task' },
} as const;

export type TaskStatus = keyof typeof taskWorkflow;
export const taskStatusValues = Object.keys(taskWorkflow) as TaskStatus[];

export interface AuthenticatedActor {
  userId: string;
  organizationId: string;
  roles: PlatformRole[];
  displayName?: string;
  email?: string;
}
