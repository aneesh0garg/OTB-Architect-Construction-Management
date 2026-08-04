'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  beginLocalLogin,
  loadCostControl,
  loadExecutionRegister,
  prepareDocumentDownload,
  loadFinanceControl,
  loadConnectedWorkspace,
  loadProjectRecord,
  loadPipeline,
  loadResourceCapacity,
  loadResourcePeople,
  loadResourceTeams,
  loadNotificationPreferences,
  loadNotifications,
  markNotificationRead,
  restoreLocalLogin,
  saveNotificationPreference,
  saveResourcePerson,
  searchProjectBrain,
  createProjectBrainDraft,
  createDocumentAnnotation,
  createFieldObservation,
  createProjectTask,
  createProjectBudget,
  createProjectCommitment,
  createProjectChangeEvent,
  createProjectInvoice,
  createPipelineOpportunity,
  createPipelineProposal,
  convertPipelineOpportunity,
  assignResourceTeamMember,
  createWorkspaceProject,
  createWorkspaceTeam,
  fileProjectCommunication,
  loadDocumentAnnotations,
  reviewProjectBrainDraft,
  signOutLocal,
  transitionProjectTask,
  transitionProjectInvoice,
  transitionWorkspaceProjectStage,
  transitionWorkspaceProjectStatus,
  recordProjectPayment,
  uploadProjectDocument,
  issueProjectDocument,
  reviewProjectDocument,
  createProjectTransmittal,
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
  type PipelineRegister,
  type CapacityRegister,
  type ResourcePerson,
  type ResourceTeam,
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
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [lifecycleMessage, setLifecycleMessage] = useState<string>();
  const [authMessage, setAuthMessage] = useState('Demo workspace');
  const project = projectRecord?.project ?? workspaceData.activeProject;

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
  async function updateLifecycle(kind: 'status' | 'stage', value: string) {
    if (!projectRecord) return;
    try {
      if (kind === 'status')
        await transitionWorkspaceProjectStatus(projectRecord.project.id, value);
      else await transitionWorkspaceProjectStage(projectRecord.project.id, value);
      await loadProjectViews(projectRecord.project.id);
      setLifecycleMessage('Project lifecycle updated.');
    } catch (error) {
      setLifecycleMessage(
        error instanceof Error ? error.message : 'Project lifecycle could not be updated.',
      );
    }
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
    workspaceData.activeProject.members.map((member) => ({
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
        <button
          className="rail-button active"
          aria-label="Workspace"
          onClick={() => setView('overview')}
        >
          ▦
        </button>
        <button
          className="rail-button"
          aria-label="Projects"
          onClick={() => setProjectMenuOpen((open) => !open)}
        >
          ◫
        </button>
        <button
          className="rail-button"
          aria-label="AI workspace"
          onClick={() => setBrainOpen(true)}
        >
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
        <button
          className="avatar avatar-small"
          aria-label="Your profile"
          onClick={() => setNotificationSettingsOpen(true)}
        >
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
          <a
            className="sidebar-link"
            href="#portfolio"
            onClick={(event) => {
              event.preventDefault();
              setPipelineOpen(true);
            }}
          >
            <span>◫</span> Portfolio
          </a>
          <a
            className="sidebar-link"
            href="#teams"
            onClick={(event) => {
              event.preventDefault();
              setStaffingOpen(true);
            }}
          >
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
            <span className="project-status">
              {(projectRecord?.project.status ?? 'active').replaceAll('_', ' ')}
            </span>
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
              suppressHydrationWarning
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
            {viewer && projectRecord && (
              <div className="lifecycle-controls">
                <label>
                  Status
                  <select
                    value={projectRecord.project.status}
                    onChange={(event) => updateLifecycle('status', event.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On hold</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>
                  Stage
                  <select
                    value={projectRecord.project.stage}
                    onChange={(event) => updateLifecycle('stage', event.target.value)}
                  >
                    <option value="pursuit">Pursuit</option>
                    <option value="concept">Concept</option>
                    <option value="schematic_design">Schematic design</option>
                    <option value="design_development">Design development</option>
                    <option value="construction_documents">Construction documents</option>
                    <option value="tender">Tender</option>
                    <option value="construction_administration">Construction administration</option>
                    <option value="handover">Handover</option>
                    <option value="warranty_defects">Warranty / defects</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
            )}
            {lifecycleMessage && <small className="lifecycle-message">{lifecycleMessage}</small>}
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
            <button className="button-secondary" onClick={() => setView('communications')}>
              Share updates
            </button>
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
              onCompleteTask={async (taskId) => {
                if (!projectRecord) return;
                await transitionProjectTask(projectRecord.project.id, taskId, 'completed');
                await loadProjectViews(projectRecord.project.id);
              }}
            />
          )}
          {view === 'drawings' && <Drawings record={projectRecord} onNavigate={setView} />}
          {view === 'field' && (
            <FieldMobile
              execution={executionRegister}
              record={projectRecord}
              signedIn={Boolean(viewer)}
              onChanged={() =>
                projectRecord ? loadProjectViews(projectRecord.project.id) : Promise.resolve()
              }
            />
          )}
          {view === 'documents' && (
            <Documents
              record={projectRecord}
              signedIn={Boolean(viewer)}
              onNavigate={setView}
              onChanged={() =>
                projectRecord ? loadProjectViews(projectRecord.project.id) : Promise.resolve()
              }
            />
          )}
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
          {view === 'cost' && (
            <CostContracts
              finance={financeControl}
              cost={costControl}
              record={projectRecord}
              signedIn={Boolean(viewer)}
              onChanged={() =>
                projectRecord ? loadProjectViews(projectRecord.project.id) : Promise.resolve()
              }
            />
          )}
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
      {pipelineOpen && (
        <PipelineDialog signedIn={Boolean(viewer)} onClose={() => setPipelineOpen(false)} />
      )}
      {staffingOpen && (
        <StaffingDialog signedIn={Boolean(viewer)} onClose={() => setStaffingOpen(false)} />
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

function StaffingDialog({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [people, setPeople] = useState<ResourcePerson[]>([]);
  const [teams, setTeams] = useState<ResourceTeam[]>([]);
  const [capacity, setCapacity] = useState<CapacityRegister>();
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('40');
  const [teamId, setTeamId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    if (!signedIn) return;
    try {
      const [nextPeople, nextTeams, nextCapacity] = await Promise.all([
        loadResourcePeople(),
        loadResourceTeams(),
        loadResourceCapacity(
          new Date().toISOString().slice(0, 10),
          new Date(Date.now() + 27 * 86400000).toISOString().slice(0, 10),
        ),
      ]);
      setPeople(nextPeople);
      setTeams(nextTeams);
      setCapacity(nextCapacity);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Staffing records could not be loaded.');
    }
  };
  useEffect(() => {
    void refresh();
  }, [signedIn]);
  const savePerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    try {
      await saveResourcePerson({
        userId: userId.trim(),
        displayName: displayName.trim(),
        weeklyCapacityHours: Number(weeklyHours),
      });
      setUserId('');
      setDisplayName('');
      setWeeklyHours('40');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Person could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  const assign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    try {
      await assignResourceTeamMember({ teamId, userId: memberId });
      setMemberId('');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Team assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="modal-card staffing-dialog"
        aria-label="Staffing and capacity"
        role="dialog"
        aria-modal="true"
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">RESOURCE MANAGEMENT</p>
            <h2>Staffing &amp; capacity</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close staffing and capacity"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {!signedIn ? (
          <p className="settings-empty">Sign in to manage people, teams, and capacity.</p>
        ) : (
          <>
            <form className="inline-form staffing-form" onSubmit={savePerson}>
              <label>
                User ID
                <input
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  required
                />
              </label>
              <label>
                Name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </label>
              <label>
                Weekly hours
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(event.target.value)}
                  required
                />
              </label>
              <button className="button-primary" disabled={saving} type="submit">
                Save person
              </button>
            </form>
            {teams.length > 0 && people.length > 0 && (
              <form className="inline-form staffing-form" onSubmit={assign}>
                <label>
                  Team
                  <select
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                    required
                  >
                    <option value="">Choose team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Person
                  <select
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                    required
                  >
                    <option value="">Choose person</option>
                    {people.map((person) => (
                      <option key={person.user_id} value={person.user_id}>
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button-primary" disabled={saving} type="submit">
                  Assign team
                </button>
              </form>
            )}
            {message && <p className="form-message">{message}</p>}
            <div className="simple-record-list">
              {(capacity?.people ?? []).map((person) => (
                <article key={person.user_id}>
                  <strong>
                    {person.display_name} · {person.utilization}% allocated
                  </strong>
                  <span>
                    {person.allocatedHours}h allocated · {person.availableHours}h available of{' '}
                    {person.capacityHours}h
                  </span>
                </article>
              ))}
              {capacity && !capacity.people.length && <p>No people have been added.</p>}
            </div>
            <div className="simple-record-list">
              {teams.map((team) => (
                <article key={team.id}>
                  <strong>{team.name}</strong>
                  <span>
                    {team.members.length
                      ? team.members.map((member) => member.display_name).join(', ')
                      : 'No members assigned'}
                  </span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PipelineDialog({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [pipeline, setPipeline] = useState<PipelineRegister>();
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [fee, setFee] = useState('');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [projectCode, setProjectCode] = useState('');
  const refresh = async () => {
    if (!signedIn) return;
    try {
      setPipeline(await loadPipeline());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pipeline could not be loaded.');
    }
  };
  useEffect(() => {
    void refresh();
  }, [signedIn]);
  const createOpportunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    try {
      await createPipelineOpportunity({
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        anticipatedFee: Number(fee) || 0,
      });
      setClientName('');
      setProjectName('');
      setFee('');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Opportunity could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const createProposal = async (opportunityId: string, project: string) => {
    const proposalFee = Number(fee) || 0;
    setSaving(true);
    setMessage(undefined);
    try {
      await createPipelineProposal(opportunityId, {
        scope: `${project} base services`,
        fee: proposalFee,
      });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Proposal could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const convert = async (opportunityId: string, proposalId: string) => {
    if (!projectCode.trim()) {
      setMessage('Enter a project code before converting this opportunity.');
      return;
    }
    setSaving(true);
    setMessage(undefined);
    try {
      await convertPipelineOpportunity(opportunityId, {
        proposalId,
        projectCode: projectCode.trim(),
      });
      setProjectCode('');
      await refresh();
      setMessage('Opportunity converted to a new project.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Opportunity could not be converted.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="modal-card pipeline-dialog"
        aria-label="Pipeline and proposals"
        role="dialog"
        aria-modal="true"
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">BUSINESS DEVELOPMENT</p>
            <h2>Pipeline &amp; proposals</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close pipeline and proposals"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {!signedIn ? (
          <p className="settings-empty">Sign in to manage opportunities and proposals.</p>
        ) : (
          <>
            <form className="modal-form" onSubmit={createOpportunity}>
              <label>
                Client
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  minLength={2}
                  required
                />
              </label>
              <label>
                Project
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  minLength={2}
                  required
                />
              </label>
              <label>
                Anticipated fee
                <input
                  type="number"
                  min="0"
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                  required
                />
              </label>
              <button className="button-primary" disabled={saving} type="submit">
                Create opportunity
              </button>
            </form>
            <label className="pipeline-conversion-code">
              Project code for conversion
              <input
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value.toUpperCase())}
                maxLength={24}
                placeholder="RR-25"
              />
            </label>
            {message && <p className="form-message">{message}</p>}
            <div className="simple-record-list pipeline-list">
              {(pipeline?.opportunities ?? []).map((opportunity) => (
                <article key={opportunity.id}>
                  <strong>
                    {opportunity.project_name} · {opportunity.client_name}
                  </strong>
                  <span>
                    {opportunity.stage} · {opportunity.probability}% · ₹
                    {Number(opportunity.anticipated_fee).toLocaleString('en-IN')}
                  </span>
                  <small>{opportunity.next_action ?? 'No next action'}</small>
                  <div>
                    {opportunity.proposals.map((proposal) => (
                      <div className="proposal-row" key={proposal.id}>
                        <small>
                          Proposal v{proposal.version} · ₹
                          {Number(proposal.fee).toLocaleString('en-IN')} · {proposal.status}
                        </small>
                        <button
                          className="button-secondary record-action"
                          disabled={saving}
                          onClick={() => convert(opportunity.id, proposal.id)}
                        >
                          Convert to project
                        </button>
                      </div>
                    ))}
                  </div>
                  {!opportunity.proposals.length && (
                    <button
                      className="button-secondary record-action"
                      disabled={saving}
                      onClick={() => createProposal(opportunity.id, opportunity.project_name)}
                    >
                      Build base proposal
                    </button>
                  )}
                </article>
              ))}
              {pipeline && !pipeline.opportunities.length && <p>No opportunities yet.</p>}
            </div>
          </>
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
  onCompleteTask,
}: {
  record: ProjectRecord | undefined;
  finance: FinanceControl | undefined;
  cost: CostControl | undefined;
  onOpenBrain: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onOpenFeed: () => void;
  onCompleteTask: (taskId: string) => Promise<void>;
}) {
  const project = workspaceData.activeProject;
  const [demoCompletedTasks, setDemoCompletedTasks] = useState<Set<string>>(new Set());
  const [updatingTaskId, setUpdatingTaskId] = useState<string>();
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
                {'id' in task ? (
                  <input
                    className="task-check"
                    aria-label={`Mark ${task.title} complete`}
                    checked={task.status === 'completed'}
                    disabled={task.status === 'completed' || updatingTaskId === task.id}
                    onChange={async (event) => {
                      if (!event.target.checked) return;
                      setUpdatingTaskId(task.id);
                      try {
                        await onCompleteTask(task.id);
                      } finally {
                        setUpdatingTaskId(undefined);
                      }
                    }}
                    type="checkbox"
                  />
                ) : (
                  <input
                    className="task-check"
                    aria-label={`Mark ${task.title} complete`}
                    checked={demoCompletedTasks.has(task.title)}
                    onChange={(event) =>
                      setDemoCompletedTasks((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(task.title);
                        else next.delete(task.title);
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                )}
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

const documentNumberCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const documentStatusOrder: Record<string, number> = { issued: 0, draft: 1, superseded: 2 };
type DocumentSort = 'number' | 'status' | 'type' | 'revision';
const sortControlledDocuments = (
  documents: ProjectRecord['documents'],
  sort: DocumentSort = 'number',
) =>
  [...documents].sort((left, right) => {
    if (sort === 'status') {
      const statusComparison =
        (documentStatusOrder[left.status] ?? 3) - (documentStatusOrder[right.status] ?? 3);
      if (statusComparison !== 0) return statusComparison;
    }
    if (sort === 'type') {
      const typeComparison = documentNumberCollator.compare(
        left.document_type,
        right.document_type,
      );
      if (typeComparison !== 0) return typeComparison;
    }
    const numberComparison = documentNumberCollator.compare(
      left.document_number,
      right.document_number,
    );
    if (numberComparison !== 0) return numberComparison;
    if (sort === 'revision') return documentNumberCollator.compare(right.revision, left.revision);
    const statusComparison =
      (documentStatusOrder[left.status] ?? 3) - (documentStatusOrder[right.status] ?? 3);
    if (statusComparison !== 0) return statusComparison;
    return documentNumberCollator.compare(right.revision, left.revision);
  });
const nextRevision = (revision: string) => {
  if (/^\d+$/.test(revision)) return String(Number(revision) + 1);
  const letters = revision.toUpperCase();
  if (!/^[A-Z]+$/.test(letters)) return 'A';
  const characters = letters.split('');
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (characters[index] !== 'Z') {
      characters[index] = String.fromCharCode(characters[index]!.charCodeAt(0) + 1);
      return characters.join('');
    }
    characters[index] = 'A';
  }
  return `A${characters.join('')}`;
};

function Documents({
  record,
  signedIn,
  onNavigate,
  onChanged,
}: {
  record: ProjectRecord | undefined;
  signedIn: boolean;
  onNavigate: (view: WorkspaceView) => void;
  onChanged: () => Promise<void>;
}) {
  const documents = record ? sortControlledDocuments(record.documents) : [];
  const [documentQuery, setDocumentQuery] = useState('');
  const [documentStatus, setDocumentStatus] = useState('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  const [documentSort, setDocumentSort] = useState<DocumentSort>('number');
  const filteredDocuments = documents.filter((document) => {
    const matchesQuery = `${document.document_number} ${document.title}`
      .toLowerCase()
      .includes(documentQuery.trim().toLowerCase());
    return (
      matchesQuery &&
      (documentStatus === 'all' || document.status === documentStatus) &&
      (documentTypeFilter === 'all' || document.document_type === documentTypeFilter)
    );
  });
  const [file, setFile] = useState<File>();
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<
    'drawing' | 'specification' | 'report' | 'contract' | 'photo' | 'other'
  >('drawing');
  const [supersedesDocumentId, setSupersedesDocumentId] = useState('');
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [transmittalPurpose, setTransmittalPurpose] = useState('Construction issue');
  const [transmittalRecipients, setTransmittalRecipients] = useState('');
  const [transmittalIds, setTransmittalIds] = useState<string[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const selectedPrior = documents.find((document) => document.id === supersedesDocumentId);
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId);
  const revision = selectedPrior ? nextRevision(selectedPrior.revision) : 'A';
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [issuingId, setIssuingId] = useState<string>();
  const [reviewingId, setReviewingId] = useState<string>();
  const [preview, setPreview] = useState<{
    title: string;
    url: string;
    expiresAt: string;
  }>();
  const [openingId, setOpeningId] = useState<string>();
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (preview) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [preview]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || !file) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await uploadProjectDocument(record.project.id, file, {
        documentType,
        title: title.trim(),
        revision: revision.trim(),
        ...(supersedesDocumentId ? { supersedesDocumentId } : {}),
        clientRequestId,
      });
      setFile(undefined);
      setTitle('');
      setSupersedesDocumentId('');
      setClientRequestId(crypto.randomUUID());
      await onChanged();
      setMessage('Document revision uploaded and added to the controlled record.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Document upload could not be completed.',
      );
    } finally {
      setSaving(false);
    }
  };
  const issue = async (document: ProjectRecord['documents'][number]) => {
    if (!record) return;
    setIssuingId(document.id);
    setMessage(undefined);
    try {
      await issueProjectDocument(record.project.id, document.id);
      await onChanged();
      setMessage(
        `${document.document_number} · Rev ${document.revision} is now issued. Any earlier issued revision with this number is superseded.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Document revision could not be issued.');
    } finally {
      setIssuingId(undefined);
    }
  };
  const review = async (
    document: ProjectRecord['documents'][number],
    action: 'submit' | 'approve' | 'reject',
  ) => {
    if (!record) return;
    setReviewingId(document.id);
    setMessage(undefined);
    try {
      await reviewProjectDocument(record.project.id, document.id, action);
      await onChanged();
      const label = { submit: 'submitted', approve: 'approved', reject: 'returned to draft' }[
        action
      ];
      setMessage(`${document.document_number} · Rev ${document.revision} was ${label}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Document review could not be recorded.');
    } finally {
      setReviewingId(undefined);
    }
  };
  const openDocument = async (document: ProjectRecord['documents'][number]) => {
    if (!record) return;
    setOpeningId(document.id);
    setMessage(undefined);
    try {
      const download = await prepareDocumentDownload(record.project.id, document.id);
      setPreview({
        title: document.title,
        url: download.downloadUrl,
        expiresAt: download.expiresAt,
      });
    } catch {
      setMessage('This revision has no downloadable original, or your access has changed.');
    } finally {
      setOpeningId(undefined);
    }
  };
  const submitTransmittal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const transmittal = await createProjectTransmittal(record.project.id, {
        purpose: transmittalPurpose,
        recipients: transmittalRecipients
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        documentIds: transmittalIds,
      });
      setTransmittalIds([]);
      setTransmittalRecipients('');
      await onChanged();
      setMessage(`Transmittal #${transmittal.transmittal_number} was created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transmittal could not be created.');
    } finally {
      setSaving(false);
    }
  };
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
        {signedIn && record && (
          <form className="document-form" onSubmit={submit}>
            <label>
              Original file
              <input
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => setFile(event.target.files?.[0])}
                required
                type="file"
              />
            </label>
            <label>
              Document number
              <input
                value={selectedPrior?.document_number ?? 'Assigned by server on save'}
                readOnly
                aria-label="Server-assigned document number"
              />
            </label>
            <label>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={2}
                required
              />
            </label>
            <label>
              Type
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as typeof documentType)}
              >
                <option value="drawing">Drawing</option>
                <option value="specification">Specification</option>
                <option value="report">Report</option>
                <option value="contract">Contract</option>
                <option value="photo">Photo</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Revision
              <input value={revision} readOnly aria-label="Generated document revision" />
            </label>
            <label>
              Supersede existing revision (optional)
              <select
                value={supersedesDocumentId}
                onChange={(event) => setSupersedesDocumentId(event.target.value)}
              >
                <option value="">Create a new document number</option>
                {documents
                  .filter((document) => document.document_type === documentType)
                  .map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.document_number} · Rev {document.revision} · {document.status}
                    </option>
                  ))}
              </select>
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              {saving ? 'Uploading…' : 'Upload revision'}
            </button>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
        {signedIn && (
          <form className="document-form" onSubmit={submitTransmittal}>
            <label>
              Transmittal purpose
              <input
                value={transmittalPurpose}
                onChange={(event) => setTransmittalPurpose(event.target.value)}
                required
              />
            </label>
            <label>
              Recipients (comma-separated)
              <input
                value={transmittalRecipients}
                onChange={(event) => setTransmittalRecipients(event.target.value)}
                required
              />
            </label>
            <fieldset className="document-transmittal-select">
              <legend>Issued documents</legend>
              {documents
                .filter((document) => document.status === 'issued')
                .map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      checked={transmittalIds.includes(document.id)}
                      onChange={(event) =>
                        setTransmittalIds((current) =>
                          event.target.checked
                            ? [...current, document.id]
                            : current.filter((id) => id !== document.id),
                        )
                      }
                    />{' '}
                    {document.document_number} · Rev {document.revision}
                  </label>
                ))}
            </fieldset>
            <button
              className="button-secondary"
              disabled={saving || transmittalIds.length === 0}
              type="submit"
            >
              Create transmittal
            </button>
          </form>
        )}
        <div className="table-toolbar document-register-toolbar">
          <input
            aria-label="Search documents"
            placeholder="Search number or title"
            value={documentQuery}
            onChange={(event) => setDocumentQuery(event.target.value)}
          />
          <select
            aria-label="Filter document status"
            value={documentStatus}
            onChange={(event) => setDocumentStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="issued">Issued</option>
            <option value="draft">Draft</option>
            <option value="internal_review">In review</option>
            <option value="approved">Approved</option>
            <option value="superseded">Superseded</option>
          </select>
          <select
            aria-label="Filter document type"
            value={documentTypeFilter}
            onChange={(event) => setDocumentTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="drawing">Drawings</option>
            <option value="specification">Specifications</option>
            <option value="report">Reports</option>
            <option value="contract">Contracts</option>
            <option value="photo">Photos</option>
            <option value="other">Other</option>
          </select>
          <select
            aria-label="Sort documents"
            value={documentSort}
            onChange={(event) => setDocumentSort(event.target.value as DocumentSort)}
          >
            <option value="number">Sort: document number</option>
            <option value="status">Sort: status</option>
            <option value="type">Sort: type</option>
            <option value="revision">Sort: revision</option>
          </select>
          <span>{filteredDocuments.length} shown</span>
        </div>
        <div className="simple-record-list">
          {filteredDocuments.length ? (
            sortControlledDocuments(filteredDocuments, documentSort).map((document) => (
              <article key={document.id}>
                <strong>
                  {document.document_number} · Rev {document.revision}
                </strong>
                <span>{document.title}</span>
                <small>
                  {document.document_type} · {document.status} · {document.issue_date ?? 'Unissued'}
                </small>
                {signedIn && document.status === 'draft' && (
                  <button
                    className="button-secondary record-action"
                    disabled={reviewingId === document.id}
                    onClick={() => void review(document, 'submit')}
                  >
                    {reviewingId === document.id ? 'Submitting…' : 'Submit for review'}
                  </button>
                )}
                {signedIn && document.status === 'internal_review' && (
                  <>
                    <button
                      className="button-secondary record-action"
                      disabled={reviewingId === document.id}
                      onClick={() => void review(document, 'approve')}
                    >
                      {reviewingId === document.id ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      className="button-secondary record-action"
                      disabled={reviewingId === document.id}
                      onClick={() => void review(document, 'reject')}
                    >
                      Return to draft
                    </button>
                  </>
                )}
                {signedIn && ['draft', 'approved'].includes(document.status) && (
                  <button
                    className="button-secondary record-action"
                    disabled={issuingId === document.id}
                    onClick={() => void issue(document)}
                  >
                    {issuingId === document.id ? 'Issuing…' : 'Issue revision'}
                  </button>
                )}
                {signedIn && document.has_original && (
                  <button
                    className="button-secondary record-action"
                    disabled={openingId === document.id}
                    onClick={() => void openDocument(document)}
                  >
                    {openingId === document.id ? 'Opening…' : 'Open original'}
                  </button>
                )}
                {document.document_type === 'drawing' && (
                  <button
                    className="button-secondary record-action"
                    onClick={() => onNavigate('drawings')}
                  >
                    Review &amp; markup
                  </button>
                )}
                <button
                  className="button-secondary record-action"
                  onClick={() => setSelectedDocumentId(document.id)}
                >
                  View details
                </button>
              </article>
            ))
          ) : (
            <p>No documents match the current register filters.</p>
          )}
        </div>
      </section>
      {preview && (
        <div ref={previewRef} tabIndex={-1}>
          <DocumentPreview preview={preview} onClose={() => setPreview(undefined)} />
        </div>
      )}
      {selectedDocument && (
        <section
          className="content-card detail-workspace"
          aria-label={`Document details for ${selectedDocument.document_number}`}
        >
          <div className="card-header">
            <div>
              <p className="eyebrow">DOCUMENT DETAIL</p>
              <h2>
                {selectedDocument.document_number} · Rev {selectedDocument.revision}
              </h2>
            </div>
            <button onClick={() => setSelectedDocumentId(undefined)}>Close</button>
          </div>
          <p>{selectedDocument.title}</p>
          <div className="record-grid">
            <div>
              <span>Status</span>
              <strong>{selectedDocument.status.replaceAll('_', ' ')}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{selectedDocument.document_type}</strong>
            </div>
            <div>
              <span>Issued</span>
              <strong>{selectedDocument.issue_date ?? 'Not issued'}</strong>
            </div>
            <div>
              <span>Original</span>
              <strong>{selectedDocument.has_original ? 'Retained' : 'Metadata only'}</strong>
            </div>
          </div>
          <p className="settings-empty">
            Linked transmittals:{' '}
            {record?.transmittals.filter((item) => item.document_ids.includes(selectedDocument.id))
              .length ?? 0}
            . Review actions and discussion are available from this controlled record.
          </p>
        </section>
      )}
    </div>
  );
}

function DocumentPreview({
  preview,
  onClose,
}: {
  preview: { title: string; url: string; expiresAt: string };
  onClose: () => void;
}) {
  const pathname = new URL(preview.url).pathname.toLowerCase();
  const isImage = /\.(jpe?g|png)$/.test(pathname);
  return (
    <section
      className="drawing-viewer document-viewer"
      aria-label={`Document viewer for ${preview.title}`}
    >
      <header>
        <div>
          <p className="eyebrow">CONTROLLED ORIGINAL</p>
          <h3>{preview.title}</h3>
        </div>
        <div>
          <small>Access link expires {new Date(preview.expiresAt).toLocaleTimeString()}</small>
          <a href={preview.url} target="_blank" rel="noreferrer">
            Open original ↗
          </a>
          <button onClick={onClose} aria-label="Close document viewer">
            ×
          </button>
        </div>
      </header>
      {isImage ? (
        <img src={preview.url} alt={preview.title} />
      ) : (
        <>
          <a className="mobile-pdf-open" href={preview.url} target="_blank" rel="noreferrer">
            Open full PDF — all pages ↗
          </a>
          <iframe title={preview.title} src={preview.url} />
        </>
      )}
    </section>
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
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

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
                <button
                  className="button-secondary record-action"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  View details
                </button>
              </article>
            ))
          ) : (
            <p>No connected project tasks are available.</p>
          )}
        </div>
      </section>
      {selectedTask && (
        <section
          className="content-card detail-workspace"
          aria-label={`Task details for ${selectedTask.title}`}
        >
          <div className="card-header">
            <div>
              <p className="eyebrow">TASK DETAIL</p>
              <h2>{selectedTask.title}</h2>
            </div>
            <button onClick={() => setSelectedTaskId(undefined)}>Close</button>
          </div>
          <div className="record-grid">
            <div>
              <span>Status</span>
              <strong>{selectedTask.status.replaceAll('_', ' ')}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{selectedTask.priority}</strong>
            </div>
            <div>
              <span>Assignee</span>
              <strong>{selectedTask.assignee_id ?? 'Unassigned'}</strong>
            </div>
            <div>
              <span>Due</span>
              <strong>{selectedTask.due_date ?? 'Not scheduled'}</strong>
            </div>
          </div>
          <p className="settings-empty">
            Discussion, activity, and linked-record history will appear here as task collaboration
            is added.
          </p>
        </section>
      )}
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
  record,
  signedIn,
  onChanged,
}: {
  finance: FinanceControl | undefined;
  cost: CostControl | undefined;
  record: ProjectRecord | undefined;
  signedIn: boolean;
  onChanged: () => Promise<void>;
}) {
  const [budgetCode, setBudgetCode] = useState('');
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [commitmentDescription, setCommitmentDescription] = useState('');
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [changeCode, setChangeCode] = useState('');
  const [changeDescription, setChangeDescription] = useState('');
  const [changeAmount, setChangeAmount] = useState('');
  const [clientName, setClientName] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const addBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await createProjectBudget(record.project.id, {
        costCode: budgetCode.trim(),
        name: budgetName.trim(),
        amount: Number(budgetAmount),
      });
      setBudgetCode('');
      setBudgetName('');
      setBudgetAmount('');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Budget could not be added.');
    } finally {
      setSaving(false);
    }
  };
  const addInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await createProjectInvoice(record.project.id, {
        clientName: clientName.trim(),
        gstRate: 18,
        lines: [
          {
            sourceType: 'manual',
            description: invoiceDescription.trim(),
            quantity: 1,
            unitAmount: Number(invoiceAmount),
          },
        ],
      });
      setClientName('');
      setInvoiceDescription('');
      setInvoiceAmount('');
      await onChanged();
      setMessage('Invoice created as a draft for internal review.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invoice could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const addCommitment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await createProjectCommitment(record.project.id, {
        vendorName: vendorName.trim(),
        description: commitmentDescription.trim(),
        originalAmount: Number(commitmentAmount),
      });
      setVendorName('');
      setCommitmentDescription('');
      setCommitmentAmount('');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Commitment could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const addChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await createProjectChangeEvent(record.project.id, {
        code: changeCode.trim(),
        description: changeDescription.trim(),
        amount: Number(changeAmount),
      });
      setChangeCode('');
      setChangeDescription('');
      setChangeAmount('');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Change event could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const recordPayment = async (invoiceId: string, total: string) => {
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await recordProjectPayment(record.project.id, invoiceId, {
        amount: Number(total),
        paidDate: new Date().toISOString().slice(0, 10),
      });
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment could not be recorded.');
    } finally {
      setSaving(false);
    }
  };
  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await transitionProjectInvoice(record.project.id, invoiceId, status);
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invoice status could not be updated.');
    } finally {
      setSaving(false);
    }
  };
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
      <section className="content-card commercial-records">
        <div className="card-header">
          <div>
            <p className="eyebrow">PROJECT ACCOUNTING</p>
            <h2>Budgets, commitments &amp; changes</h2>
          </div>
          <span>{cost?.budgets.length ?? 0} budget lines</span>
        </div>
        {signedIn && record && (
          <form className="inline-form budget-form" onSubmit={addBudget}>
            <label>
              Cost code
              <input
                value={budgetCode}
                onChange={(event) => setBudgetCode(event.target.value)}
                required
              />
            </label>
            <label>
              Budget name
              <input
                value={budgetName}
                onChange={(event) => setBudgetName(event.target.value)}
                required
              />
            </label>
            <label>
              Amount
              <input
                min="0"
                step="0.01"
                type="number"
                value={budgetAmount}
                onChange={(event) => setBudgetAmount(event.target.value)}
                required
              />
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              Add budget
            </button>
          </form>
        )}
        {signedIn && record && (
          <form className="inline-form budget-form" onSubmit={addCommitment}>
            <label>
              Vendor
              <input
                value={vendorName}
                onChange={(event) => setVendorName(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <input
                value={commitmentDescription}
                onChange={(event) => setCommitmentDescription(event.target.value)}
                required
              />
            </label>
            <label>
              Amount
              <input
                min="0"
                step="0.01"
                type="number"
                value={commitmentAmount}
                onChange={(event) => setCommitmentAmount(event.target.value)}
                required
              />
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              Add commitment
            </button>
          </form>
        )}
        {signedIn && record && (
          <form className="inline-form budget-form" onSubmit={addChange}>
            <label>
              Change code
              <input
                value={changeCode}
                onChange={(event) => setChangeCode(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <input
                value={changeDescription}
                onChange={(event) => setChangeDescription(event.target.value)}
                required
              />
            </label>
            <label>
              Amount
              <input
                step="0.01"
                type="number"
                value={changeAmount}
                onChange={(event) => setChangeAmount(event.target.value)}
                required
              />
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              Add change
            </button>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
        <div className="simple-record-list">
          {(cost?.budgets ?? []).map((budget) => (
            <article key={budget.id}>
              <strong>
                {budget.cost_code} · {budget.name}
              </strong>
              <span>₹{Number(budget.amount).toLocaleString('en-IN')}</span>
            </article>
          ))}
          {(cost?.commitments ?? []).map((commitment) => (
            <article key={commitment.id}>
              <strong>
                {commitment.vendor_name} · {commitment.description}
              </strong>
              <span>
                ₹{Number(commitment.approved_amount).toLocaleString('en-IN')} · {commitment.status}
              </span>
            </article>
          ))}
          {(cost?.changeEvents ?? []).map((change) => (
            <article key={change.id}>
              <strong>
                {change.code} · {change.description}
              </strong>
              <span>
                ₹{Number(change.amount).toLocaleString('en-IN')} · {change.status}
              </span>
            </article>
          ))}
          {!cost && <p>Sign in to load project accounting records.</p>}
        </div>
      </section>
      <section className="content-card commercial-records">
        <div className="card-header">
          <div>
            <p className="eyebrow">INVOICING &amp; PAYMENTS</p>
            <h2>Receivables</h2>
          </div>
          <span>{finance?.invoices.length ?? 0} invoices</span>
        </div>
        {signedIn && record && (
          <form className="inline-form invoice-form" onSubmit={addInvoice}>
            <label>
              Client
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <input
                value={invoiceDescription}
                onChange={(event) => setInvoiceDescription(event.target.value)}
                required
              />
            </label>
            <label>
              Amount
              <input
                min="0.01"
                step="0.01"
                type="number"
                value={invoiceAmount}
                onChange={(event) => setInvoiceAmount(event.target.value)}
                required
              />
            </label>
            <button className="button-primary" disabled={saving} type="submit">
              Create invoice
            </button>
          </form>
        )}
        <div className="simple-record-list">
          {(finance?.invoices ?? []).map((invoice) => (
            <article key={invoice.id}>
              <strong>
                INV-{invoice.invoice_number} · ₹{Number(invoice.total).toLocaleString('en-IN')}
              </strong>
              <span>
                {invoice.status.replaceAll('_', ' ')} · Accounting {invoice.accounting_sync_status}
              </span>
              {signedIn && invoice.status === 'draft' && (
                <button
                  className="button-secondary record-action"
                  disabled={saving}
                  onClick={() => updateInvoiceStatus(invoice.id, 'internal_review')}
                >
                  Send for internal review
                </button>
              )}
              {signedIn && invoice.status === 'internal_review' && (
                <button
                  className="button-secondary record-action"
                  disabled={saving}
                  onClick={() => updateInvoiceStatus(invoice.id, 'issued')}
                >
                  Issue invoice
                </button>
              )}
              {signedIn && ['issued', 'partially_paid'].includes(invoice.status) && (
                <button
                  className="button-secondary record-action"
                  disabled={saving}
                  onClick={() => recordPayment(invoice.id, invoice.total)}
                >
                  Record full payment
                </button>
              )}
            </article>
          ))}
          {(finance?.payments ?? []).map((payment) => (
            <article key={payment.id}>
              <strong>Payment · ₹{Number(payment.amount).toLocaleString('en-IN')}</strong>
              <span>
                {payment.paid_date}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </span>
            </article>
          ))}
          {!finance && <p>Sign in to load invoices and payments.</p>}
        </div>
      </section>
    </div>
  );
}

function Drawings({
  record,
  onNavigate,
}: {
  record: ProjectRecord | undefined;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const [preview, setPreview] = useState<{
    title: string;
    documentNumber: string;
    url: string;
    expiresAt: string;
    documentId: string;
    isImage: boolean;
  }>();
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [annotationBody, setAnnotationBody] = useState('');
  const [annotationX, setAnnotationX] = useState(50);
  const [annotationY, setAnnotationY] = useState(50);
  const [openError, setOpenError] = useState<string>();
  const [showCurrentOnly, setShowCurrentOnly] = useState(false);
  const [drawingSort, setDrawingSort] = useState<DocumentSort>('number');
  const drawings = record
    ? sortControlledDocuments(record.documents, drawingSort).filter(
        (document) => document.document_type === 'drawing',
      )
    : workspaceData.activeProject.drawings;
  const filteredDrawings = showCurrentOnly
    ? drawings.filter((drawing) => ['issued', 'Current'].includes(drawing.status))
    : drawings;
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
        isImage: /\.(jpe?g|png)$/i.test(new URL(download.downloadUrl).pathname),
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
        xPercent: annotationX,
        yPercent: annotationY,
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
          <button
            className="button-secondary"
            onClick={() => setShowCurrentOnly((current) => !current)}
          >
            {showCurrentOnly ? 'Show all' : 'Current only'}
          </button>
          <select
            aria-label="Sort drawings"
            value={drawingSort}
            onChange={(event) => setDrawingSort(event.target.value as DocumentSort)}
          >
            <option value="number">Sort: drawing number</option>
            <option value="status">Sort: status</option>
            <option value="revision">Sort: revision</option>
          </select>
          <button className="button-primary" onClick={() => onNavigate('documents')}>
            Upload drawing
          </button>
        </div>
      </div>
      <section className="content-card drawing-table-card">
        <div className="table-toolbar">
          <strong>{filteredDrawings.length} drawings</strong>
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
          {filteredDrawings.map((drawing) => (
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
          {preview.isImage ? (
            <img className="drawing-original-image" src={preview.url} alt={preview.title} />
          ) : (
            <>
              <a className="mobile-pdf-open" href={preview.url} target="_blank" rel="noreferrer">
                Open full PDF — all pages ↗
              </a>
              <iframe title={preview.title} src={preview.url} />
            </>
          )}
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
              <label>
                Horizontal pin · {annotationX}%
                <input
                  aria-label="Horizontal drawing pin"
                  type="range"
                  min="0"
                  max="100"
                  value={annotationX}
                  onChange={(event) => setAnnotationX(Number(event.target.value))}
                />
              </label>
              <label>
                Vertical pin · {annotationY}%
                <input
                  aria-label="Vertical drawing pin"
                  type="range"
                  min="0"
                  max="100"
                  value={annotationY}
                  onChange={(event) => setAnnotationY(Number(event.target.value))}
                />
              </label>
            </div>
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

function FieldMobile({
  execution,
  record,
  signedIn,
  onChanged,
}: {
  execution: ExecutionRegister | undefined;
  record: ProjectRecord | undefined;
  signedIn: boolean;
  onChanged: () => Promise<void>;
}) {
  const items = execution?.observations ?? workspaceData.activeProject.field;
  const [captureOpen, setCaptureOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const capture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await createFieldObservation(record.project.id, {
        title: title.trim(),
        priority,
        ...(location.trim() ? { location: location.trim() } : {}),
      });
      setTitle('');
      setLocation('');
      await onChanged();
      setCaptureOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Observation could not be captured.');
    } finally {
      setSaving(false);
    }
  };
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
        <button className="capture-button" onClick={() => setCaptureOpen(true)}>
          ＋ Capture observation
        </button>
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
      {captureOpen && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="modal-card"
            role="dialog"
            aria-label="Capture field observation"
            aria-modal="true"
          >
            <div className="card-header">
              <div>
                <p className="eyebrow">FIELD CAPTURE</p>
                <h2>New observation</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close field observation"
                onClick={() => setCaptureOpen(false)}
              >
                ×
              </button>
            </div>
            {!signedIn ? (
              <p className="settings-empty">Sign in to capture a project observation.</p>
            ) : (
              <form className="modal-form" onSubmit={capture}>
                <label>
                  Title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={2}
                    required
                  />
                </label>
                <label>
                  Location
                  <input value={location} onChange={(event) => setLocation(event.target.value)} />
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
                {message && <p className="form-message">{message}</p>}
                <button className="button-primary" disabled={saving} type="submit">
                  Capture observation
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
