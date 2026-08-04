'use client';

import { useEffect, useState } from 'react';
import {
  beginLocalLogin,
  loadExecutionRegister,
  loadFinanceControl,
  loadConnectedWorkspace,
  loadProjectRecord,
  restoreLocalLogin,
  signOutLocal,
  type ConnectedWorkspace,
  type ExecutionRegister,
  type FinanceControl,
  type ProjectRecord,
  type Viewer,
} from './local-auth';
import { type WorkspaceView, workspaceData } from './workspace-data';

type Theme = 'light' | 'dark' | 'system';

const projectNav: { label: string; icon: string; view?: WorkspaceView }[] = [
  { label: 'Overview', icon: '⌂', view: 'overview' },
  { label: 'Drawings', icon: '▧', view: 'drawings' },
  { label: 'Field work', icon: '⌖', view: 'field' },
  { label: 'Documents', icon: '▤' },
  { label: 'Tasks', icon: '✓' },
  { label: 'Communications', icon: '◌' },
  { label: 'Cost & contracts', icon: '₹' },
];

export default function Home() {
  const [theme, setTheme] = useState<Theme>('system');
  const [view, setView] = useState<WorkspaceView>('overview');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [viewer, setViewer] = useState<Viewer>();
  const [connectedWorkspace, setConnectedWorkspace] = useState<ConnectedWorkspace>();
  const [projectRecord, setProjectRecord] = useState<ProjectRecord>();
  const [financeControl, setFinanceControl] = useState<FinanceControl>();
  const [executionRegister, setExecutionRegister] = useState<ExecutionRegister>();
  const [authMessage, setAuthMessage] = useState('Demo workspace');
  const project = workspaceData.activeProject;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    restoreLocalLogin()
      .then(async (identity) => {
        if (identity) {
          setViewer(identity);
          const workspace = await loadConnectedWorkspace();
          setConnectedWorkspace(workspace);
          if (workspace.projects[0]) {
            await loadProjectViews(workspace.projects[0].id);
          }
          setAuthMessage('Connected to local workspace');
        }
      })
      .catch((error: unknown) =>
        setAuthMessage(error instanceof Error ? error.message : 'Local sign-in is unavailable.'),
      );
  }, []);

  async function loadProjectViews(projectId: string) {
    const [record, finance, execution] = await Promise.all([
      loadProjectRecord(projectId),
      loadFinanceControl(projectId),
      loadExecutionRegister(projectId),
    ]);
    setProjectRecord(record);
    setFinanceControl(finance);
    setExecutionRegister(execution);
  }

  const initials = viewer
    ? viewer.userId.slice(0, 2).toUpperCase()
    : workspaceData.organization.user.initials;
  const projects = connectedWorkspace
    ? connectedWorkspace.projects.map((item) => ({ ...item, progress: 0 }))
    : workspaceData.projects;
  const teams = connectedWorkspace
    ? connectedWorkspace.teams.map((team) => team.name)
    : workspaceData.organization.teams;

  return (
    <main className="workspace-shell">
      <aside className="app-rail" aria-label="Primary navigation">
        <div className="brand-mark" aria-label="Orbita">
          O
        </div>
        <button className="rail-button active" aria-label="Workspace">
          ▦
        </button>
        <button className="rail-button" aria-label="Projects">
          ◫
        </button>
        <button className="rail-button" aria-label="AI workspace">
          ✦
        </button>
        <button className="rail-button" aria-label="Notifications">
          ◔<span className="rail-dot" />
        </button>
        <div className="rail-spacer" />
        <button className="avatar avatar-small" aria-label="Your profile">
          {initials}
        </button>
      </aside>

      <aside className="workspace-sidebar">
        <div className="firm-switcher">
          <div className="firm-logo">N</div>
          <div>
            <strong>{workspaceData.organization.name}</strong>
            <span>{workspaceData.organization.plan}</span>
          </div>
          <button aria-label="Switch organization">⌄</button>
        </div>
        <nav className="sidebar-section" aria-label="Firm navigation">
          <a className="sidebar-link active" href="#workspace">
            <span>⌂</span> Home
          </a>
          <a className="sidebar-link" href="#portfolio">
            <span>◫</span> Portfolio
          </a>
          <a className="sidebar-link" href="#teams">
            <span>◉</span> My teams
          </a>
        </nav>
        <div className="sidebar-heading">
          <span>PROJECTS</span>
          <button aria-label="Create project">+</button>
        </div>
        <nav className="project-list" aria-label="Projects">
          {projects.map((item) => (
            <button
              className={item.code === project.code ? 'project-link selected' : 'project-link'}
              key={item.code}
              onClick={() =>
                'id' in item
                  ? loadProjectViews(item.id).catch((error: unknown) =>
                      setAuthMessage(
                        error instanceof Error
                          ? error.message
                          : 'Project data could not be loaded.',
                      ),
                    )
                  : item.code === project.code && setProjectMenuOpen(!projectMenuOpen)
              }
            >
              <span className="project-dot" />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.code} · {item.status}
                </small>
              </span>
              {item.code === project.code && <span className="project-chevron">⌄</span>}
            </button>
          ))}
        </nav>
        {projectMenuOpen && (
          <div className="project-menu-note">
            Project picker is ready for connected project records.
          </div>
        )}
        <div className="sidebar-heading sidebar-heading-team">
          <span>TEAMS</span>
          <button aria-label="Create team">+</button>
        </div>
        <div className="team-list">
          {teams.map((team) => (
            <span key={team}># {team}</span>
          ))}
        </div>
        <div className="sidebar-footer">
          <button className="upgrade-card">
            <span>✦</span>
            <strong>Ask Orbita AI</strong>
            <small>Search project evidence with citations</small>
          </button>
          <button className="user-card">
            <span className="avatar">{initials}</span>
            <span>
              <strong>
                {viewer ? 'Signed-in workspace' : workspaceData.organization.user.name}
              </strong>
              <small>
                {viewer ? viewer.roles.join(' · ') : workspaceData.organization.user.role}
              </small>
            </span>
            <span>⋮</span>
          </button>
        </div>
      </aside>

      <section className="project-workspace">
        <header className="topbar">
          <div className="crumbs">
            <span>Projects</span>
            <b>/</b>
            <strong>{project.name}</strong>
            <span className="project-status">Active</span>
          </div>
          <div className="top-actions">
            <button className="search-button">
              ⌕ <span>Search this project</span>
              <kbd>⌘ K</kbd>
            </button>
            <button className="icon-button" aria-label="Project activity">
              ◔
            </button>
            <button
              className="auth-button"
              onClick={() =>
                viewer
                  ? (signOutLocal(),
                    setViewer(undefined),
                    setConnectedWorkspace(undefined),
                    setAuthMessage('Demo workspace'))
                  : beginLocalLogin().catch((error: unknown) =>
                      setAuthMessage(
                        error instanceof Error ? error.message : 'Unable to start sign-in.',
                      ),
                    )
              }
            >
              {viewer ? 'Sign out' : 'Sign in'}
            </button>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </header>
        <div className={viewer ? 'connection-banner connected' : 'connection-banner'}>
          {viewer ? `Authenticated as ${viewer.organizationId}` : authMessage}
        </div>
        <div className="project-header">
          <div>
            <p className="eyebrow">
              {project.code} · {project.location}
            </p>
            <h1>{project.name}</h1>
            <p className="stage-label">{project.stage}</p>
          </div>
          <div className="project-header-actions">
            <div className="member-stack">
              {project.members.map((member) => (
                <span key={member}>{member}</span>
              ))}
            </div>
            <button className="button-secondary">Share</button>
            <button className="button-primary">+ New</button>
          </div>
        </div>
        <nav className="project-tabs" aria-label="Project sections">
          {projectNav.map((item) => (
            <button
              key={item.label}
              disabled={!item.view}
              onClick={() => item.view && setView(item.view)}
              className={view === item.view ? 'project-tab active' : 'project-tab'}
            >
              <span>{item.icon}</span>
              {item.label}
              {!item.view && <small>Later</small>}
            </button>
          ))}
        </nav>
        {view === 'overview' && <Overview record={projectRecord} finance={financeControl} />}
        {view === 'drawings' && <Drawings record={projectRecord} />}
        {view === 'field' && <FieldMobile execution={executionRegister} />}
      </section>
    </main>
  );
}

function Overview({
  record,
  finance,
}: {
  record: ProjectRecord | undefined;
  finance: FinanceControl | undefined;
}) {
  const project = workspaceData.activeProject;
  return (
    <div className="workspace-content overview-view">
      <section className="snapshot-grid">
        {project.snapshot.map((item) => (
          <article className="snapshot-card" key={item.label}>
            <span className={`signal ${item.tone}`} />
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>
      <div className="content-grid">
        <section className="content-card attention-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">WORK QUEUE</p>
              <h2>Needs attention</h2>
            </div>
            <button>View all →</button>
          </div>
          <div className="task-list">
            {(record?.tasks ?? project.tasks).map((task) => (
              <article className="task-row" key={task.title}>
                <span className="task-check" />
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {'state' in task
                      ? `${task.state} · Due ${task.due}`
                      : `${task.status} · ${task.due_date ? `Due ${task.due_date}` : 'No due date'}`}
                  </span>
                </div>
                <span className="task-owner">
                  {'owner' in task
                    ? task.owner
                    : (task.assignee_id?.slice(0, 2).toUpperCase() ?? '—')}
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="content-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">RECENT RECORD</p>
              <h2>Project activity</h2>
            </div>
            <button>Open feed →</button>
          </div>
          <div className="activity-list">
            {project.activity.map((event) => (
              <article className="activity-row" key={event.target}>
                <span className="activity-icon">●</span>
                <p>
                  <strong>{event.actor}</strong> {event.action} <b>{event.target}</b>
                  <small>{event.time}</small>
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="content-card project-record">
        <div className="card-header">
          <div>
            <p className="eyebrow">PROJECT RECORD</p>
            <h2>Issued evidence &amp; current information</h2>
          </div>
          <button>Open documents →</button>
        </div>
        <div className="record-grid">
          <div>
            <span>Current drawing package</span>
            <strong>Architecture · Rev G</strong>
            <small>Issued 12 Mar 2026</small>
          </div>
          <div>
            <span>Next site visit</span>
            <strong>Friday, 15 March</strong>
            <small>09:30 · Riverside site</small>
          </div>
          <div>
            <span>Open correspondence</span>
            <strong>{record?.communications.length ?? 7} filed conversations</strong>
            <small>Available to permitted project users</small>
          </div>
        </div>
      </section>
      <div className="control-grid">
        <section className="content-card commercial-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">COMMERCIAL CONTROL</p>
              <h2>Fee, time &amp; collections</h2>
            </div>
            <button>Open project control →</button>
          </div>
          <div className="commercial-metrics">
            <div>
              <span>Planned fee</span>
              <strong>
                {finance
                  ? `₹${finance.health.plannedFee.toLocaleString('en-IN')}`
                  : project.commercial.plannedFee}
              </strong>
              <small>Construction administration</small>
            </div>
            <div>
              <span>Invoiced / collected</span>
              <strong>
                {finance
                  ? `₹${finance.health.invoiced.toLocaleString('en-IN')}`
                  : project.commercial.invoiced}
              </strong>
              <small>
                {finance
                  ? `₹${finance.health.paid.toLocaleString('en-IN')} received`
                  : `${project.commercial.collected} received`}
              </small>
            </div>
            <div>
              <span>Logged hours</span>
              <strong>
                {finance
                  ? `${finance.health.loggedHours} / ${finance.health.targetHours}`
                  : project.commercial.hours}
              </strong>
              <small>{project.commercial.staffing}</small>
            </div>
          </div>
          <div className="commercial-footer">
            <span className="finance-dot" /> <strong>{project.commercial.invoice}</strong>
            <small> GST-ready source lines and payment trace available</small>
          </div>
        </section>
        <section className="content-card brain-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">PROJECT BRAIN</p>
              <h2>Evidence before answers</h2>
            </div>
            <span className="brain-status">{project.brain.enabled ? 'Enabled' : 'Off'}</span>
          </div>
          <p className="brain-prompt">“{project.brain.prompt}”</p>
          <div className="citation-list">
            {project.brain.citations.map((citation, index) => (
              <span key={citation}>
                <b>[{index + 1}]</b> {citation}
              </span>
            ))}
          </div>
          <footer>
            <span>Review-required draft</span>
            <button>Ask Orbita AI →</button>
          </footer>
        </section>
      </div>
    </div>
  );
}

function Drawings({ record }: { record: ProjectRecord | undefined }) {
  const drawings =
    record?.documents.filter((document) => document.document_type === 'drawing') ??
    workspaceData.activeProject.drawings;
  return (
    <div className="workspace-content drawings-view">
      <div className="drawings-hero">
        <div>
          <p className="eyebrow">CURRENT PROJECT RECORD</p>
          <h2>Drawings</h2>
          <p>One controlled register for current, issued and superseded evidence.</p>
        </div>
        <div>
          <button className="button-secondary">Filter</button>
          <button className="button-primary">Upload drawing</button>
        </div>
      </div>
      <section className="content-card drawing-table-card">
        <div className="table-toolbar">
          <strong>{drawings.length} drawings</strong>
          <span>Revision control is ready for connected records</span>
        </div>
        <div className="drawing-table" role="table">
          <div className="drawing-row drawing-head" role="row">
            <span>Number</span>
            <span>Title</span>
            <span>Revision</span>
            <span>Issued</span>
            <span>Status</span>
            <span />
          </div>
          {drawings.map((drawing) => (
            <div
              className="drawing-row"
              role="row"
              key={'document_number' in drawing ? drawing.id : drawing.number}
            >
              <strong>
                {'document_number' in drawing ? drawing.document_number : drawing.number}
              </strong>
              <span>{drawing.title}</span>
              <span>{drawing.revision}</span>
              <span>
                {'issue_date' in drawing ? (drawing.issue_date ?? 'Unissued') : drawing.issued}
              </span>
              <span
                className={`status-pill ${drawing.status === 'Current' || drawing.status === 'issued' ? 'current' : 'superseded'}`}
              >
                {drawing.status}
              </span>
              <button
                aria-label={`Open ${'document_number' in drawing ? drawing.document_number : drawing.number}`}
              >
                →
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FieldMobile({ execution }: { execution: ExecutionRegister | undefined }) {
  const items = execution?.observations ?? workspaceData.activeProject.field;
  return (
    <div className="field-page">
      <div className="field-explainer">
        <p className="eyebrow">MOBILE-ONLY WORKFLOW</p>
        <h2>Field work is designed for the job site.</h2>
        <p>
          Capture observations, photos, location and assignees offline; synchronize when a
          connection returns.
        </p>
        <span>Use the Orbita mobile app to create or resolve field records.</span>
      </div>
      <section className="phone-frame" aria-label="Field work mobile preview">
        <div className="phone-status">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>
        <div className="phone-header">
          <button>‹</button>
          <div>
            <strong>Riverside Residences</strong>
            <small>Field work</small>
          </div>
          <button>⌕</button>
        </div>
        <div className="phone-filter">
          <strong>Open observations</strong>
          <span>12</span>
        </div>
        <div className="phone-list">
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <span className={`priority-dot ${item.priority.toLowerCase()}`} />
                <small>
                  {'observation_number' in item
                    ? `SO-${item.observation_number} · ${item.sync_state}`
                    : `${item.id} · ${item.area}`}
                </small>
              </div>
              <strong>{item.title}</strong>
              <footer>
                <span>{item.priority}</span>
                <b>{'state' in item ? item.state : item.status}</b>
              </footer>
            </article>
          ))}
        </div>
        <button className="capture-button">＋ Capture observation</button>
        <div className="phone-nav">
          <span>
            ⌂<small>Home</small>
          </span>
          <span className="selected">
            ⌖<small>Field</small>
          </span>
          <span>
            ☷<small>Tasks</small>
          </span>
          <span>
            ◉<small>More</small>
          </span>
        </div>
      </section>
    </div>
  );
}
