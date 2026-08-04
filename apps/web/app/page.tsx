'use client';

import { type FormEvent, useEffect, useState } from 'react';
import {
  beginLocalLogin,
  loadCostControl,
  loadExecutionRegister,
  prepareDocumentDownload,
  loadFinanceControl,
  loadConnectedWorkspace,
  loadProjectRecord,
  loadNotificationPreferences,
  loadNotifications,
  markNotificationRead,
  restoreLocalLogin,
  saveNotificationPreference,
  searchProjectBrain,
  createProjectBrainDraft,
  createDocumentAnnotation,
  createProjectTask,
  createWorkspaceProject,
  createWorkspaceTeam,
  fileProjectCommunication,
  loadDocumentAnnotations,
  reviewProjectBrainDraft,
  signOutLocal,
  transitionProjectTask,
  type ConnectedWorkspace,
  type CostControl,
  type ExecutionRegister,
  type FinanceControl,
  type AiCitation,
  type AiDraft,
  type NotificationPreference,
  type WorkspaceNotification,
  type DocumentAnnotation,
  type ProjectRecord,
  type Viewer,
} from './local-auth';
import { type WorkspaceView, workspaceData } from './workspace-data';

type Theme = 'light' | 'dark' | 'system';

const projectNav: { label: string; icon: string; view?: WorkspaceView }[] = [
  { label: 'Overview', icon: '⌂', view: 'overview' },
  { label: 'Drawings', icon: '▧', view: 'drawings' },
  { label: 'Field work', icon: '⌖', view: 'field' },
  { label: 'Documents', icon: '▤', view: 'documents' },
  { label: 'Tasks', icon: '✓', view: 'tasks' },
  { label: 'Communications', icon: '◌', view: 'communications' },
  { label: 'Cost & contracts', icon: '₹', view: 'cost' },
];

export default function Home() {
  const [theme, setTheme] = useState<Theme>('system');
  const [view, setView] = useState<WorkspaceView>('overview');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [viewer, setViewer] = useState<Viewer>();
  const [connectedWorkspace, setConnectedWorkspace] = useState<ConnectedWorkspace>();
  const [projectRecord, setProjectRecord] = useState<ProjectRecord>();
  const [financeControl, setFinanceControl] = useState<FinanceControl>();
  const [costControl, setCostControl] = useState<CostControl>();
  const [executionRegister, setExecutionRegister] = useState<ExecutionRegister>();
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>(
    [],
  );
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [notificationFeedOpen, setNotificationFeedOpen] = useState(false);
  const [workspaceDialog, setWorkspaceDialog] = useState<'project' | 'team'>();
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
          setNotificationPreferences(await loadNotificationPreferences());
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
    const [record, finance, cost, execution] = await Promise.all([
      loadProjectRecord(projectId),
      loadFinanceControl(projectId),
      loadCostControl(projectId),
      loadExecutionRegister(projectId),
    ]);
    setProjectRecord(record);
    setFinanceControl(finance);
    setCostControl(cost);
    setExecutionRegister(execution);
  }
  async function refreshWorkspace() {
    const workspace = await loadConnectedWorkspace();
    setConnectedWorkspace(workspace);
    return workspace;
  }

  const initials = viewer
    ? (viewer.displayName ?? viewer.userId)
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : workspaceData.organization.user.initials;
  const projects = connectedWorkspace
    ? connectedWorkspace.projects.map((item) => ({ ...item, progress: 0 }))
    : workspaceData.projects;
  const teams = connectedWorkspace
    ? connectedWorkspace.teams.map((team) => team.name)
    : workspaceData.organization.teams;
  const projectMembers =
    projectRecord?.members ??
    project.members.map((member) => ({
      user_id: member,
      display_name: member,
      role: 'Project member',
      title: null,
    }));

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
        <button
          className="rail-button"
          aria-label="Notifications"
          onClick={() => setNotificationFeedOpen(true)}
        >
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
        {viewer && (
          <div className="signed-in-user" title={viewer.email ?? viewer.userId}>
            <span className="signed-in-user-avatar">{initials}</span>
            <span>
              <strong>{viewer.displayName ?? viewer.userId}</strong>
              <small>{viewer.roles.join(' · ').replaceAll('_', ' ')}</small>
            </span>
          </div>
        )}
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
          <button aria-label="Create project" onClick={() => setWorkspaceDialog('project')}>
            +
          </button>
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
          <button aria-label="Create team" onClick={() => setWorkspaceDialog('team')}>
            +
          </button>
        </div>
        <div className="team-list">
          {teams.map((team) => (
            <span key={team}># {team}</span>
          ))}
        </div>
        <div className="sidebar-footer">
          <button className="upgrade-card" onClick={() => setBrainOpen(true)}>
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
            <button
              className="icon-button"
              aria-label="Project activity"
              onClick={() => setNotificationFeedOpen(true)}
            >
              ◔
            </button>
            <button
              className="icon-button"
              aria-label="Notification settings"
              data-testid="notification-settings-trigger"
              onClick={() => setNotificationSettingsOpen(true)}
            >
              ⚙
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
              {projectMembers.slice(0, 4).map((member) => (
                <span
                  key={member.user_id}
                  title={`${member.display_name ?? member.user_id} · ${member.role.replaceAll('_', ' ')}`}
                >
                  {(member.display_name ?? member.user_id)
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              ))}
              {projectMembers.length > 4 && (
                <span title="Additional project members">+{projectMembers.length - 4}</span>
              )}
            </div>
            <button className="button-secondary">Share</button>
            <button className="button-primary" onClick={() => setWorkspaceDialog('project')}>
              + New project
            </button>
          </div>
        </div>
        <nav className="project-tabs" aria-label="Project sections">
          {projectNav.map((item) => (
            <button
              key={item.label}
              disabled={!item.view}
              onClick={() => item.view && setView(item.view)}
              className={view === item.view ? 'project-tab active' : 'project-tab'}
              data-testid={`project-tab-${item.view ?? item.label.toLowerCase().replaceAll(' ', '-')}`}
              aria-current={item.view && view === item.view ? 'page' : undefined}
              title={
                item.view ? `Open ${item.label}` : `${item.label} is planned for a later release`
              }
            >
              <span>{item.icon}</span>
              {item.label}
              {!item.view && <small>Later</small>}
            </button>
          ))}
        </nav>
        <div
          className="project-view"
          data-testid={`project-view-${view}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {view === 'overview' && (
            <Overview
              record={projectRecord}
              finance={financeControl}
              cost={costControl}
              onOpenBrain={() => setBrainOpen(true)}
              onNavigate={setView}
              onOpenFeed={() => setNotificationFeedOpen(true)}
            />
          )}
          {view === 'drawings' && <Drawings record={projectRecord} />}
          {view === 'field' && <FieldMobile execution={executionRegister} />}
          {view === 'documents' && <Documents record={projectRecord} />}
          {view === 'tasks' && (
            <Tasks
              record={projectRecord}
              signedIn={Boolean(viewer)}
              onChanged={() =>
                projectRecord ? loadProjectViews(projectRecord.project.id) : Promise.resolve()
              }
            />
          )}
          {view === 'communications' && (
            <Communications
              record={projectRecord}
              signedIn={Boolean(viewer)}
              sender={viewer?.displayName ?? viewer?.email ?? viewer?.userId}
              onChanged={() =>
                projectRecord ? loadProjectViews(projectRecord.project.id) : Promise.resolve()
              }
            />
          )}
          {view === 'cost' && <CostContracts finance={financeControl} cost={costControl} />}
        </div>
      </section>
      {notificationSettingsOpen && (
        <NotificationSettings
          preferences={notificationPreferences}
          signedIn={Boolean(viewer)}
          onClose={() => setNotificationSettingsOpen(false)}
          onSaved={(preference) =>
            setNotificationPreferences((current) => [
              ...current.filter((item) => item.event_type !== preference.event_type),
              preference,
            ])
          }
        />
      )}
      {brainOpen && (
        <ProjectBrain
          projectId={projectRecord?.project.id}
          signedIn={Boolean(viewer)}
          onClose={() => setBrainOpen(false)}
        />
      )}
      {notificationFeedOpen && (
        <NotificationFeed
          signedIn={Boolean(viewer)}
          onClose={() => setNotificationFeedOpen(false)}
        />
      )}
      {workspaceDialog && (
        <WorkspaceCreationDialog
          kind={workspaceDialog}
          signedIn={Boolean(viewer)}
          onClose={() => setWorkspaceDialog(undefined)}
          onCreated={async (createdProjectId) => {
            await refreshWorkspace();
            if (createdProjectId) await loadProjectViews(createdProjectId);
          }}
        />
      )}
    </main>
  );
}

function WorkspaceCreationDialog({
  kind,
  signedIn,
  onClose,
  onCreated,
}: {
  kind: 'project' | 'team';
  signedIn: boolean;
  onClose: () => void;
  onCreated: (projectId?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isProject = kind === 'project';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signedIn) return;
    setSaving(true);
    setMessage(undefined);
    try {
      if (isProject) {
        const project = await createWorkspaceProject({
          name: name.trim(),
          code: code.trim(),
          ...(location.trim() ? { location: location.trim() } : {}),
        });
        await onCreated(project.id);
      } else {
        await createWorkspaceTeam(name.trim());
        await onCreated();
      }
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `The ${kind} could not be created.`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="modal-card" aria-label={`Create ${kind}`} role="dialog" aria-modal="true">
        <div className="card-header">
          <div>
            <p className="eyebrow">WORKSPACE SETUP</p>
            <h2>Create {isProject ? 'project' : 'team'}</h2>
          </div>
          <button className="icon-button" aria-label={`Close create ${kind}`} onClick={onClose}>
            ×
          </button>
        </div>
        {!signedIn ? (
          <p className="settings-empty">Sign in to create projects and teams in your workspace.</p>
        ) : (
          <form className="modal-form" onSubmit={submit}>
            <label>
              {isProject ? 'Project name' : 'Team name'}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                required
              />
            </label>
            {isProject && (
              <>
                <label>
                  Project code
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    minLength={2}
                    maxLength={24}
                    required
                  />
                </label>
                <label>
                  Location <small>(optional)</small>
                  <input value={location} onChange={(event) => setLocation(event.target.value)} />
                </label>
              </>
            )}
            {message && <p className="form-message">{message}</p>}
            <button className="button-primary" disabled={saving} type="submit">
              {saving ? 'Creating…' : `Create ${kind}`}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function NotificationFeed({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(signedIn);
  useEffect(() => {
    if (!signedIn) return;
    loadNotifications()
      .then(setNotifications)
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : 'Notifications could not be loaded.'),
      )
      .finally(() => setLoading(false));
  }, [signedIn]);
  const markRead = async (notification: WorkspaceNotification) => {
    if (notification.read_at) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Notification could not be updated.');
    }
  };
  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="notification-settings notification-feed"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-feed-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h2 id="notification-feed-title">Notifications</h2>
          </div>
          <button className="icon-button" aria-label="Close notifications" onClick={onClose}>
            ×
          </button>
        </header>
        {!signedIn ? (
          <p className="settings-empty">Sign in to view your permitted project activity.</p>
        ) : (
          <div className="notification-list">
            {loading && <p className="settings-empty">Loading notifications…</p>}
            {!loading && notifications.length === 0 && (
              <p className="settings-empty">You are all caught up.</p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                className={notification.read_at ? 'notification-item' : 'notification-item unread'}
                onClick={() => void markRead(notification)}
                aria-label={`${notification.read_at ? 'Read' : 'Mark read'}: ${notification.title}`}
              >
                <span className="notification-marker" />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                  <time>{new Date(notification.created_at).toLocaleString()}</time>
                </span>
              </button>
            ))}
            {message && (
              <p className="settings-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectBrain({
  projectId,
  signedIn,
  onClose,
}: {
  projectId: string | undefined;
  signedIn: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<AiDraft['intent']>('rfi_draft');
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [draft, setDraft] = useState<AiDraft>();
  const [message, setMessage] = useState<string>();
  const [working, setWorking] = useState(false);
  const canUseBrain = signedIn && Boolean(projectId);
  const search = async () => {
    if (!projectId || !query.trim()) return;
    setWorking(true);
    setMessage(undefined);
    try {
      const result = await searchProjectBrain(projectId, query.trim());
      setCitations(result.citations);
      setMessage(result.notice);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setWorking(false);
    }
  };
  const createDraft = async () => {
    if (!projectId || !query.trim()) return;
    setWorking(true);
    setMessage(undefined);
    try {
      const created = await createProjectBrainDraft(projectId, { intent, prompt: query.trim() });
      setDraft(created);
      setCitations(created.citations);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft creation failed.');
    } finally {
      setWorking(false);
    }
  };
  const review = async (decision: 'approve' | 'reject') => {
    if (!projectId || !draft) return;
    setWorking(true);
    setMessage(undefined);
    try {
      setDraft(await reviewProjectBrainDraft(projectId, draft.id, decision));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft review failed.');
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="notification-settings brain-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brain-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">GOVERNED PROJECT BRAIN</p>
            <h2 id="brain-title">Evidence before answers</h2>
          </div>
          <button className="icon-button" aria-label="Close Project Brain" onClick={onClose}>
            ×
          </button>
        </header>
        {!canUseBrain ? (
          <p className="settings-empty">
            Sign in and open a connected project to use Project Brain.
          </p>
        ) : (
          <div className="settings-form">
            <label>
              What do you need to prepare?
              <textarea
                aria-label="Project Brain request"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Draft an RFI for the façade cavity depth"
              />
            </label>
            <label>
              Draft type
              <select
                value={intent}
                onChange={(event) => setIntent(event.target.value as AiDraft['intent'])}
              >
                <option value="rfi_draft">RFI draft</option>
                <option value="site_report">Site report</option>
                <option value="meeting_minutes">Meeting minutes</option>
                <option value="risk_summary">Risk summary</option>
                <option value="submittal_review">Submittal review</option>
                <option value="record_search">Record search</option>
              </select>
            </label>
            <div className="brain-actions">
              <button
                className="button-secondary"
                onClick={search}
                disabled={!query.trim() || working}
              >
                Find evidence
              </button>
              <button
                className="button-primary"
                onClick={createDraft}
                disabled={!query.trim() || working}
                data-testid="create-brain-draft"
              >
                {working ? 'Working…' : 'Create review draft'}
              </button>
            </div>
            {citations.length > 0 && (
              <div className="brain-results">
                <strong>Permitted evidence</strong>
                {citations.map((citation, index) => (
                  <article key={`${citation.source_id}-${index}`}>
                    <b>[{index + 1}]</b>
                    <span>
                      {citation.title}
                      <small>{citation.excerpt}</small>
                    </span>
                  </article>
                ))}
              </div>
            )}
            {draft && (
              <div className="brain-draft">
                <p className="eyebrow">{draft.status.replaceAll('_', ' ')}</p>
                <pre>{draft.content}</pre>
                {draft.status === 'review_required' && (
                  <div className="brain-actions">
                    <button
                      className="button-secondary"
                      onClick={() => review('reject')}
                      disabled={working}
                    >
                      Reject
                    </button>
                    <button
                      className="button-primary"
                      onClick={() => review('approve')}
                      disabled={working}
                    >
                      Approve draft
                    </button>
                  </div>
                )}
              </div>
            )}
            {message && (
              <p className="settings-message" role="status">
                {message}
              </p>
            )}
            <p className="brain-safety">
              Drafts never issue correspondence or change project data. Review and use the approved
              content in the relevant controlled workflow.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const notificationEvents = [
  ['*', 'All project activity'],
  ['task.assigned', 'Task assignments'],
  ['observation.comment_added', 'Observation comments'],
  ['workflow.issued', 'Issued workflows'],
  ['invoice.issued', 'Issued invoices'],
  ['payment.recorded', 'Recorded payments'],
] as const;

function NotificationSettings({
  preferences,
  signedIn,
  onClose,
  onSaved,
}: {
  preferences: NotificationPreference[];
  signedIn: boolean;
  onClose: () => void;
  onSaved: (preference: NotificationPreference) => void;
}) {
  const [eventType, setEventType] = useState<(typeof notificationEvents)[number][0]>('*');
  const selected = preferences.find((preference) => preference.event_type === eventType);
  const [inAppEnabled, setInAppEnabled] = useState(selected?.in_app_enabled ?? true);
  const [emailEnabled, setEmailEnabled] = useState(selected?.email_enabled ?? false);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(Boolean(selected?.quiet_hours_start));
  const [quietHoursStart, setQuietHoursStart] = useState(
    selected?.quiet_hours_start?.slice(0, 5) ?? '18:00',
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    selected?.quiet_hours_end?.slice(0, 5) ?? '08:00',
  );
  const [digestFrequency, setDigestFrequency] = useState<
    NotificationPreference['digest_frequency']
  >(selected?.digest_frequency ?? 'immediate');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  function selectEvent(nextEventType: (typeof notificationEvents)[number][0]) {
    setEventType(nextEventType);
    const next = preferences.find((preference) => preference.event_type === nextEventType);
    setInAppEnabled(next?.in_app_enabled ?? true);
    setEmailEnabled(next?.email_enabled ?? false);
    setQuietHoursEnabled(Boolean(next?.quiet_hours_start));
    setQuietHoursStart(next?.quiet_hours_start?.slice(0, 5) ?? '18:00');
    setQuietHoursEnd(next?.quiet_hours_end?.slice(0, 5) ?? '08:00');
    setDigestFrequency(next?.digest_frequency ?? 'immediate');
    setMessage(undefined);
  }

  async function save() {
    setSaving(true);
    setMessage(undefined);
    try {
      const preference = await saveNotificationPreference({
        eventType,
        inAppEnabled,
        emailEnabled,
        digestFrequency,
        ...(quietHoursEnabled ? { quietHoursStart, quietHoursEnd } : {}),
      });
      onSaved(preference);
      setMessage('Saved.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Notification settings could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="notification-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h2 id="notification-settings-title">Notification settings</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close notification settings"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {!signedIn ? (
          <p className="settings-empty">Sign in to set your delivery preferences.</p>
        ) : (
          <div className="settings-form">
            <label>
              Apply to
              <select
                aria-label="Notification event"
                value={eventType}
                onChange={(event) => selectEvent(event.target.value as typeof eventType)}
              >
                {notificationEvents.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-toggle">
              <span>
                <strong>In-app notifications</strong>
                <small>Show activity in your Orbita feed.</small>
              </span>
              <input
                aria-label="Enable in-app notifications"
                type="checkbox"
                checked={inAppEnabled}
                onChange={(event) => setInAppEnabled(event.target.checked)}
              />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Email notifications</strong>
                <small>Requires an approved organization sender.</small>
              </span>
              <input
                aria-label="Enable email notifications"
                type="checkbox"
                checked={emailEnabled}
                onChange={(event) => setEmailEnabled(event.target.checked)}
              />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Quiet hours</strong>
                <small>New in-app activity stays hidden until your quiet period ends.</small>
              </span>
              <input
                aria-label="Enable quiet hours"
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(event) => setQuietHoursEnabled(event.target.checked)}
              />
            </label>
            {quietHoursEnabled && (
              <div className="quiet-hours">
                <label>
                  From
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(event) => setQuietHoursStart(event.target.value)}
                  />
                </label>
                <label>
                  Until
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(event) => setQuietHoursEnd(event.target.value)}
                  />
                </label>
              </div>
            )}
            <label>
              Email digest
              <select
                value={digestFrequency}
                onChange={(event) =>
                  setDigestFrequency(
                    event.target.value as NotificationPreference['digest_frequency'],
                  )
                }
              >
                <option value="immediate">Immediate</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="none">No email digest</option>
              </select>
            </label>
            {message && (
              <p className="settings-message" role="status">
                {message}
              </p>
            )}
            <footer>
              <button className="button-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button-primary"
                onClick={save}
                disabled={saving}
                data-testid="save-notification-preferences"
              >
                {saving ? 'Saving…' : 'Save preferences'}
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}

function Overview({
  record,
  finance,
  cost,
  onOpenBrain,
  onNavigate,
  onOpenFeed,
}: {
  record: ProjectRecord | undefined;
  finance: FinanceControl | undefined;
  cost: CostControl | undefined;
  onOpenBrain: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onOpenFeed: () => void;
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
            <button onClick={() => onNavigate('tasks')}>View all →</button>
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
            <button onClick={onOpenFeed}>Open feed →</button>
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
          <button onClick={() => onNavigate('documents')}>Open documents →</button>
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
            <button onClick={() => onNavigate('cost')}>Open project control →</button>
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
          <div className="cost-strip">
            <div>
              <span>Owner cost budget</span>
              <strong>{cost ? `₹${cost.health.budget.toLocaleString('en-IN')}` : '—'}</strong>
            </div>
            <div>
              <span>Forecast at completion</span>
              <strong>
                {cost ? `₹${cost.health.forecastAtCompletion.toLocaleString('en-IN')}` : '—'}
              </strong>
            </div>
            <div>
              <span>Forecast variance</span>
              <strong
                className={cost && cost.health.forecastVariance > 0 ? 'cost-alert' : undefined}
              >
                {cost ? `₹${cost.health.forecastVariance.toLocaleString('en-IN')}` : '—'}
              </strong>
            </div>
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
            <button onClick={onOpenBrain}>Ask Orbita AI →</button>
          </footer>
        </section>
      </div>
    </div>
  );
}

function Documents({ record }: { record: ProjectRecord | undefined }) {
  const documents = record?.documents ?? [];
  return (
    <div className="workspace-content">
      <section className="content-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">CONTROLLED PROJECT RECORD</p>
            <h2>Documents</h2>
          </div>
          <span>{documents.length} records</span>
        </div>
        <div className="simple-record-list">
          {documents.length ? (
            documents.map((document) => (
              <article key={document.id}>
                <strong>
                  {document.document_number} · Rev {document.revision}
                </strong>
                <span>{document.title}</span>
                <small>
                  {document.document_type} · {document.status} · {document.issue_date ?? 'Unissued'}
                </small>
              </article>
            ))
          ) : (
            <p>No controlled documents are available until you sign in and select a project.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Tasks({
  record,
  signedIn,
  onChanged,
}: {
  record: ProjectRecord | undefined;
  signedIn: boolean;
  onChanged: () => Promise<void>;
}) {
  const tasks = record?.tasks ?? [];
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || !title.trim()) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await createProjectTask(record.project.id, { title: title.trim(), priority });
      setTitle('');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const completeTask = async (taskId: string, completed: boolean) => {
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await transitionProjectTask(
        record.project.id,
        taskId,
        completed ? 'completed' : 'in_progress',
      );
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task status could not be updated.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="workspace-content">
      <section className="content-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">PROJECT WORK</p>
            <h2>Tasks</h2>
          </div>
          <span>{tasks.length} tasks</span>
        </div>
        {signedIn && record && (
          <form className="inline-form" onSubmit={createTask}>
            <label>
              New task
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              Add task
            </button>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
        <div className="simple-record-list">
          {tasks.length ? (
            tasks.map((task) => (
              <article key={task.id}>
                <div className="task-record">
                  <input
                    aria-label={`Mark ${task.title} complete`}
                    checked={task.status === 'completed'}
                    disabled={!signedIn || saving || ['cancelled'].includes(task.status)}
                    onChange={(event) => completeTask(task.id, event.target.checked)}
                    type="checkbox"
                  />
                  <strong>{task.title}</strong>
                </div>
                <span>
                  {task.status.replaceAll('_', ' ')} · {task.priority}
                </span>
                <small>
                  {task.due_date ? `Due ${task.due_date}` : 'No due date'} ·{' '}
                  {task.assignee_id ?? 'Unassigned'}
                </small>
              </article>
            ))
          ) : (
            <p>No connected project tasks are available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Communications({
  record,
  signedIn,
  sender,
  onChanged,
}: {
  record: ProjectRecord | undefined;
  signedIn: boolean;
  sender: string | undefined;
  onChanged: () => Promise<void>;
}) {
  const communications = record?.communications ?? [];
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const fileNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || !subject.trim() || !body.trim() || !sender) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await fileProjectCommunication(record.project.id, {
        channel: 'manual_note',
        direction: 'internal',
        subject: subject.trim(),
        body: body.trim(),
        sender,
        recipients: [],
      });
      setSubject('');
      setBody('');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Message could not be filed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="workspace-content">
      <section className="content-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">FILED PROJECT MESSAGES</p>
            <h2>Communications</h2>
          </div>
          <span>{communications.length} messages</span>
        </div>
        {signedIn && record && (
          <form className="inline-form communication-form" onSubmit={fileNote}>
            <label>
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
            </label>
            <label>
              Project note
              <textarea value={body} onChange={(event) => setBody(event.target.value)} required />
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              File note
            </button>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
        <div className="simple-record-list">
          {communications.length ? (
            communications.map((message) => (
              <article key={message.id}>
                <strong>{message.subject}</strong>
                <span>
                  {message.channel} · {message.sender}
                </span>
                <p>{message.body}</p>
                <small>Filed {new Date(message.filed_at).toLocaleString()}</small>
              </article>
            ))
          ) : (
            <p>No filed communications are available for this project.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function CostContracts({
  finance,
  cost,
}: {
  finance: FinanceControl | undefined;
  cost: CostControl | undefined;
}) {
  return (
    <div className="workspace-content">
      <section className="content-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">COMMERCIAL CONTROL</p>
            <h2>Cost &amp; contracts</h2>
          </div>
        </div>
        <div className="record-grid">
          <div>
            <span>Planned fee</span>
            <strong>
              {finance ? `₹${finance.health.plannedFee.toLocaleString('en-IN')}` : '—'}
            </strong>
            <small>
              {finance
                ? `${finance.health.loggedHours} logged hours`
                : 'Sign in to load financial controls'}
            </small>
          </div>
          <div>
            <span>Invoiced / paid</span>
            <strong>
              {finance
                ? `₹${finance.health.invoiced.toLocaleString('en-IN')} / ₹${finance.health.paid.toLocaleString('en-IN')}`
                : '—'}
            </strong>
            <small>
              {finance ? `₹${finance.health.outstanding.toLocaleString('en-IN')} outstanding` : ''}
            </small>
          </div>
          <div>
            <span>Owner cost forecast</span>
            <strong>
              {cost ? `₹${cost.health.forecastAtCompletion.toLocaleString('en-IN')}` : '—'}
            </strong>
            <small>
              {cost ? `Variance ₹${cost.health.forecastVariance.toLocaleString('en-IN')}` : ''}
            </small>
          </div>
        </div>
      </section>
    </div>
  );
}

function Drawings({ record }: { record: ProjectRecord | undefined }) {
  const [preview, setPreview] = useState<{
    title: string;
    documentNumber: string;
    url: string;
    expiresAt: string;
    documentId: string;
  }>();
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [annotationBody, setAnnotationBody] = useState('');
  const [openError, setOpenError] = useState<string>();
  const drawings =
    record?.documents.filter((document) => document.document_type === 'drawing') ??
    workspaceData.activeProject.drawings;
  const openDrawing = async (drawing: (typeof drawings)[number]) => {
    if (!record || !('id' in drawing)) {
      setOpenError('Sign in to open a controlled drawing original.');
      return;
    }
    setOpenError(undefined);
    try {
      const download = await prepareDocumentDownload(record.project.id, drawing.id);
      setPreview({
        title: drawing.title,
        documentNumber: drawing.document_number,
        url: download.downloadUrl,
        expiresAt: download.expiresAt,
        documentId: drawing.id,
      });
      setAnnotations(await loadDocumentAnnotations(record.project.id, drawing.id));
    } catch {
      setOpenError('This revision has no downloadable original, or your access has changed.');
    }
  };
  const addAnnotation = async () => {
    if (!record || !preview || !annotationBody.trim()) return;
    try {
      const annotation = await createDocumentAnnotation(record.project.id, preview.documentId, {
        body: annotationBody.trim(),
        pageNumber: 1,
        xPercent: 50,
        yPercent: 50,
      });
      setAnnotations((current) => [...current, annotation]);
      setAnnotationBody('');
    } catch {
      setOpenError('The drawing comment could not be saved.');
    }
  };
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
                onClick={() => openDrawing(drawing)}
              >
                →
              </button>
            </div>
          ))}
        </div>
      </section>
      {openError && <p className="drawing-open-error">{openError}</p>}
      {preview && (
        <section
          className="drawing-viewer"
          aria-label={`Drawing viewer for ${preview.documentNumber}`}
        >
          <header>
            <div>
              <p className="eyebrow">CONTROLLED ORIGINAL</p>
              <h3>
                {preview.documentNumber} · {preview.title}
              </h3>
            </div>
            <div>
              <small>Access link expires {new Date(preview.expiresAt).toLocaleTimeString()}</small>
              <a href={preview.url} target="_blank" rel="noreferrer">
                Open original ↗
              </a>
              <button onClick={() => setPreview(undefined)} aria-label="Close drawing viewer">
                ×
              </button>
            </div>
          </header>
          <iframe title={preview.title} src={preview.url} />
          <div className="drawing-annotations">
            <strong>Comments &amp; pins</strong>
            {annotations.map((annotation) => (
              <p key={annotation.id}>
                <b>
                  Page {annotation.page_number}
                  {annotation.x_percent !== null && annotation.y_percent !== null
                    ? ` · Pin ${annotation.x_percent}%, ${annotation.y_percent}%`
                    : ''}
                </b>
                {annotation.body}
              </p>
            ))}
            <div>
              <input
                aria-label="Drawing comment"
                value={annotationBody}
                onChange={(event) => setAnnotationBody(event.target.value)}
                placeholder="Add a review comment"
              />
              <button onClick={addAnnotation} disabled={!annotationBody.trim()}>
                Add pin comment
              </button>
            </div>
          </div>
        </section>
      )}
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
