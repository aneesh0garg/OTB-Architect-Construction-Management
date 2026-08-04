export type WorkspaceView = 'overview' | 'drawings' | 'field';

export const workspaceData = {
  organization: {
    name: 'Northline Studio',
    plan: 'Pilot workspace',
    user: { name: 'Aarav Mehta', initials: 'AM', role: 'Project director' },
    teams: ['Design delivery', 'Construction administration', 'Finance'],
  },
  projects: [
    { name: 'Riverside Residences', code: 'RR-24', status: 'Active', progress: 68 },
    { name: 'The Doon Courtyard', code: 'DC-24', status: 'Pre-construction', progress: 36 },
    { name: 'Himalayan House', code: 'HH-25', status: 'Planning', progress: 12 },
  ],
  activeProject: {
    name: 'Riverside Residences',
    code: 'RR-24',
    location: 'Mussoorie Road, Dehradun',
    stage: 'Construction administration',
    members: ['AM', 'NK', 'SR', '4+'],
    snapshot: [
      { label: 'Open items', value: '18', detail: '6 need your attention', tone: 'amber' },
      { label: 'Drawing set', value: '42', detail: 'Current revision · G', tone: 'green' },
      { label: 'This week', value: '4', detail: 'Meetings & site visits', tone: 'blue' },
      { label: 'Project health', value: 'On track', detail: 'Updated today', tone: 'green' },
    ],
    tasks: [
      { title: 'Review staircase shop drawing', owner: 'NK', due: 'Today', state: 'Needs review' },
      { title: 'Issue facade material instruction', owner: 'AM', due: 'Tomorrow', state: 'Draft' },
      {
        title: 'Close site observation SO-018',
        owner: 'SR',
        due: 'Fri, 15 Mar',
        state: 'In progress',
      },
    ],
    activity: [
      {
        actor: 'Neha Kapoor',
        action: 'uploaded',
        target: 'A-204 Stair detail — Rev G',
        time: '12 min ago',
      },
      { actor: 'Site team', action: 'recorded', target: 'Observation SO-018', time: '48 min ago' },
      {
        actor: 'Aarav Mehta',
        action: 'assigned',
        target: 'Facade instruction to you',
        time: 'Yesterday',
      },
    ],
    drawings: [
      {
        number: 'A-101',
        title: 'Ground floor plan',
        revision: 'G',
        issued: '12 Mar 2026',
        status: 'Current',
      },
      {
        number: 'A-204',
        title: 'Stair detail',
        revision: 'G',
        issued: '12 Mar 2026',
        status: 'Current',
      },
      {
        number: 'S-301',
        title: 'Slab reinforcement',
        revision: 'F',
        issued: '08 Mar 2026',
        status: 'Superseded',
      },
      {
        number: 'M-112',
        title: 'Plumbing layout',
        revision: 'E',
        issued: '03 Mar 2026',
        status: 'Current',
      },
    ],
    field: [
      {
        id: 'SO-018',
        title: 'Parapet waterproofing continuity',
        priority: 'High',
        area: 'Roof level',
        state: 'Open',
      },
      {
        id: 'SO-017',
        title: 'Window sill level at unit 2B',
        priority: 'Medium',
        area: 'Level 2',
        state: 'In review',
      },
      {
        id: 'SO-016',
        title: 'Temporary edge protection',
        priority: 'High',
        area: 'Level 4',
        state: 'Closed',
      },
    ],
    commercial: {
      plannedFee: '₹2.50L',
      invoiced: '₹59,000',
      collected: '₹59,000',
      hours: '7.5 / 320',
      staffing: '120h allocated through June',
      invoice: 'INV-001 · Paid 25 Mar',
    },
    brain: {
      enabled: true,
      prompt: 'Draft a response request about facade cavity depth',
      citations: [
        'RFI #1 · Confirm facade cavity depth',
        'Facade sample confirmation',
        'Review facade shop drawing',
      ],
    },
  },
} as const;
