export const taskWorkflow = {
  open: { label: 'Open', next: 'in_progress', action: 'Start progress' },
  in_progress: { label: 'In Progress', next: 'in_acceptance', action: 'Send to acceptance' },
  in_acceptance: { label: 'In Acceptance', next: 'done', action: 'Mark done' },
  done: { label: 'Done', next: 'open', action: 'Reopen task' },
} as const;

export type TaskStatus = keyof typeof taskWorkflow;
