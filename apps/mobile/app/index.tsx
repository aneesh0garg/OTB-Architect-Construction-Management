import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  createSiteVisitReport,
  createObservationTask,
  createObservationWorkflow,
  type MobileSession,
  restoreSession,
  signIn,
  signOut,
  submitFieldVisit,
  submitObservation,
  submitObservationComment,
} from './mobile-session';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SyncState = 'local' | 'syncing' | 'synced' | 'failed' | 'conflict';
type MobileTab = 'home' | 'field' | 'tasks' | 'more';
type Observation = {
  id: string;
  title: string;
  area: string;
  priority: 'High' | 'Medium' | 'Low';
  state: 'Open' | 'In review' | 'Closed';
  sync: SyncState;
  serverId?: string;
  taskId?: string;
  rfiId?: string;
  siteInstructionId?: string;
  comments: FieldComment[];
};
type FieldComment = {
  id: string;
  body: string;
  createdAt: string;
  sync: SyncState;
  serverId?: string;
};
type FieldVisit = {
  id: string;
  visitDate: string;
  location: string;
  attendees: string[];
  weather: string;
  checklist: string[];
  notes: string;
  sync: SyncState;
  serverId?: string;
  reportId?: string;
};

const fieldDatabase = SQLite.openDatabaseAsync('orbita-field.db');

async function initializeFieldStore() {
  const database = await fieldDatabase;
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS local_observations (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS local_field_visits (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

async function loadLocalObservations() {
  const database = await initializeFieldStore();
  const rows = await database.getAllAsync<{ payload: string }>(
    'SELECT payload FROM local_observations ORDER BY updated_at DESC',
  );
  return rows.flatMap((row) => {
    try {
      const observation = JSON.parse(row.payload) as Partial<Observation>;
      if (!observation.id || !observation.title) return [];
      return [{ ...observation, comments: observation.comments ?? [] } as Observation];
    } catch {
      return [];
    }
  });
}

async function persistObservation(observation: Observation) {
  const database = await initializeFieldStore();
  await database.runAsync(
    'INSERT INTO local_observations (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
    observation.id,
    JSON.stringify(observation),
    new Date().toISOString(),
  );
}

async function loadLocalFieldVisits() {
  const database = await initializeFieldStore();
  const rows = await database.getAllAsync<{ payload: string }>(
    'SELECT payload FROM local_field_visits ORDER BY updated_at DESC',
  );
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload) as FieldVisit];
    } catch {
      return [];
    }
  });
}

async function persistFieldVisit(visit: FieldVisit) {
  const database = await initializeFieldStore();
  await database.runAsync(
    'INSERT INTO local_field_visits (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
    visit.id,
    JSON.stringify(visit),
    new Date().toISOString(),
  );
}

const initialObservations: Observation[] = [
  {
    id: 'SO-018',
    title: 'Parapet waterproofing continuity',
    area: 'Roof level',
    priority: 'High',
    state: 'Open',
    sync: 'synced',
    comments: [],
  },
  {
    id: 'SO-017',
    title: 'Window sill level at unit 2B',
    area: 'Level 2',
    priority: 'Medium',
    state: 'In review',
    sync: 'synced',
    comments: [],
  },
  {
    id: 'SO-016',
    title: 'Temporary edge protection',
    area: 'Level 4',
    priority: 'High',
    state: 'Closed',
    sync: 'synced',
    comments: [],
  },
];

const syncCopy: Record<SyncState, string> = {
  local: 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'All changes synced',
  failed: 'Sync failed — retry required',
  conflict: 'Conflict needs review',
};

const mobileTabs: { id: MobileTab; icon: string; label: string; title: string }[] = [
  { id: 'home', icon: '⌂', label: 'Home', title: 'Site home' },
  { id: 'field', icon: '⌖', label: 'Field', title: 'Field work' },
  { id: 'tasks', icon: '☷', label: 'Tasks', title: 'My tasks' },
  { id: 'more', icon: '◉', label: 'More', title: 'Project settings' },
];

export default function HomeScreen() {
  const [observations, setObservations] = useState(initialObservations);
  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [visitCaptureOpen, setVisitCaptureOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visitLocation, setVisitLocation] = useState('Riverside site');
  const [visitAttendees, setVisitAttendees] = useState('');
  const [visitWeather, setVisitWeather] = useState('');
  const [visitChecklist, setVisitChecklist] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [activeTab, setActiveTab] = useState<MobileTab>('field');
  const [session, setSession] = useState<MobileSession>();
  const [accountError, setAccountError] = useState<string>();
  const [selectedReportObservationIds, setSelectedReportObservationIds] = useState<string[]>([]);
  const [commentObservationId, setCommentObservationId] = useState<string>();
  const [commentBody, setCommentBody] = useState('');
  const openCount = useMemo(
    () => observations.filter((item) => item.state !== 'Closed').length,
    [observations],
  );
  const openObservations = useMemo(
    () => observations.filter((item) => item.state !== 'Closed'),
    [observations],
  );
  const queuedCount = useMemo(
    () =>
      observations.filter((item) => item.sync !== 'synced').length +
      observations.reduce(
        (count, item) =>
          count + item.comments.filter((comment) => comment.sync !== 'synced').length,
        0,
      ) +
      visits.filter((visit) => visit.sync !== 'synced').length,
    [observations, visits],
  );
  const linkedTaskObservations = useMemo(
    () => observations.filter((item) => item.taskId),
    [observations],
  );
  const currentTab = mobileTabs.find((tab) => tab.id === activeTab) ?? mobileTabs[1]!;

  useEffect(() => {
    let active = true;
    Promise.all([loadLocalObservations(), loadLocalFieldVisits()])
      .then(([storedObservations, storedVisits]) => {
        if (!active) return;
        setObservations((current) => [
          ...storedObservations,
          ...current.filter((item) => !storedObservations.some((saved) => saved.id === item.id)),
        ]);
        if (storedVisits.length > 0) setVisits(storedVisits);
        if (
          storedObservations.some((item) => item.sync !== 'synced') ||
          storedVisits.some((visit) => visit.sync !== 'synced')
        ) {
          setSyncState('local');
        }
      })
      .catch(() => active && setSyncState('failed'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    restoreSession()
      .then(setSession)
      .catch(() => setAccountError('Could not restore your session.'));
  }, []);

  const connectAccount = async () => {
    setAccountError(undefined);
    try {
      const next = await signIn();
      if (next) setSession(next);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not sign in.');
    }
  };

  const disconnectAccount = async () => {
    await signOut();
    setSession(undefined);
  };

  const captureObservation = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const localRecord: Observation = {
      id: `SO-${String(19 + observations.length).padStart(3, '0')}`,
      title: cleanTitle,
      area: 'Current location',
      priority: 'Medium',
      state: 'Open',
      sync: 'local',
      comments: [],
    };
    setObservations((current) => [localRecord, ...current]);
    await persistObservation(localRecord);
    setSyncState('local');
    setTitle('');
    setCaptureOpen(false);
  };
  const addLocalComment = async (observation: Observation) => {
    const body = commentBody.trim();
    if (!body) return;
    const updated: Observation = {
      ...observation,
      comments: [
        ...observation.comments,
        {
          id: `CM-${Date.now().toString(36).toUpperCase()}`,
          body,
          createdAt: new Date().toISOString(),
          sync: 'local',
        },
      ],
    };
    setObservations((current) =>
      current.map((item) => (item.id === observation.id ? updated : item)),
    );
    await persistObservation(updated);
    setSyncState('local');
    setCommentBody('');
    setCommentObservationId(undefined);
  };
  const captureFieldVisit = async () => {
    const location = visitLocation.trim();
    if (!location) return;
    const visit: FieldVisit = {
      id: `FV-${Date.now().toString(36).toUpperCase()}`,
      visitDate: visitDate.trim() || new Date().toISOString().slice(0, 10),
      location,
      attendees: visitAttendees
        .split(',')
        .map((attendee) => attendee.trim())
        .filter(Boolean),
      weather: visitWeather.trim(),
      checklist: visitChecklist
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      notes: visitNotes.trim(),
      sync: 'local',
    };
    setVisits((current) => [visit, ...current]);
    await persistFieldVisit(visit);
    setSyncState('local');
    setVisitCaptureOpen(false);
    setVisitAttendees('');
    setVisitWeather('');
    setVisitChecklist('');
    setVisitNotes('');
  };
  const createTaskFromObservation = async (observation: Observation) => {
    if (!session) {
      setAccountError('Sign in before creating a project task.');
      return;
    }
    if (!observation.serverId || observation.sync !== 'synced') {
      setAccountError('Sync this observation before creating its project task.');
      return;
    }
    try {
      const task = await createObservationTask(session, {
        observationId: observation.serverId,
        title: observation.title,
        priority: observation.priority,
      });
      const updated = { ...observation, taskId: task.id };
      setObservations((current) =>
        current.map((item) => (item.id === observation.id ? updated : item)),
      );
      await persistObservation(updated);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Task creation failed.');
    }
  };
  const createWorkflowFromObservation = async (
    observation: Observation,
    type: 'rfi' | 'site_instruction',
  ) => {
    if (!session) {
      setAccountError('Sign in before preparing a project workflow.');
      return;
    }
    if (!observation.serverId || observation.sync !== 'synced') {
      setAccountError('Sync this observation before preparing a project workflow.');
      return;
    }
    try {
      const workflow = await createObservationWorkflow(session, {
        observationId: observation.serverId,
        observationTitle: observation.title,
        type,
      });
      const updated =
        type === 'rfi'
          ? { ...observation, rfiId: workflow.id }
          : { ...observation, siteInstructionId: workflow.id };
      setObservations((current) =>
        current.map((item) => (item.id === observation.id ? updated : item)),
      );
      await persistObservation(updated);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Workflow preparation failed.');
    }
  };
  const toggleReportObservation = (observation: Observation) => {
    if (!observation.serverId || observation.sync !== 'synced') return;
    setSelectedReportObservationIds((current) =>
      current.includes(observation.serverId!)
        ? current.filter((id) => id !== observation.serverId)
        : [...current, observation.serverId!],
    );
  };
  const createReportFromVisit = async (visit: FieldVisit) => {
    if (!session) {
      setAccountError('Sign in before preparing a site-visit report.');
      return;
    }
    if (!visit.serverId || visit.sync !== 'synced') {
      setAccountError('Sync the site visit before preparing its report.');
      return;
    }
    if (selectedReportObservationIds.length === 0) {
      setAccountError('Select at least one synchronized observation for the report.');
      return;
    }
    try {
      const report = await createSiteVisitReport(session, {
        visitId: visit.serverId,
        visitDate: visit.visitDate,
        location: visit.location,
        observationIds: selectedReportObservationIds,
      });
      const updated = { ...visit, reportId: report.id };
      setVisits((current) => current.map((item) => (item.id === visit.id ? updated : item)));
      await persistFieldVisit(updated);
      setSelectedReportObservationIds([]);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Report creation failed.');
    }
  };
  const retrySync = async () => {
    if (!session) {
      setAccountError('Sign in before syncing field captures.');
      setSyncState('failed');
      return;
    }
    setSyncState('syncing');
    const queuedObservations = observations.filter((item) => item.sync !== 'synced');
    const queuedVisits = visits.filter((visit) => visit.sync !== 'synced');
    try {
      const visitResults = await Promise.all(
        queuedVisits.map(async (item) => ({ item, server: await submitFieldVisit(session, item) })),
      );
      const observationResults = await Promise.all(
        queuedObservations.map(async (item) => ({
          item,
          server: await submitObservation(session, item),
        })),
      );
      const syncedObservations = observationResults.map(({ item, server }) => ({
        ...item,
        serverId: server.id,
        sync: 'synced' as const,
      }));
      const observationsAfterCapture = observations.map(
        (item) => syncedObservations.find((saved) => saved.id === item.id) ?? item,
      );
      const commentResults = await Promise.all(
        observationsAfterCapture.flatMap((observation) =>
          observation.serverId
            ? observation.comments
                .filter((comment) => comment.sync !== 'synced')
                .map(async (comment) => ({
                  observationId: observation.id,
                  commentId: comment.id,
                  server: await submitObservationComment(session, {
                    observationId: observation.serverId!,
                    body: comment.body,
                    clientCommentId: comment.id,
                  }),
                }))
            : [],
        ),
      );
      const finalizedObservations = observationsAfterCapture.map((observation) => ({
        ...observation,
        comments: observation.comments.map((comment) => {
          const synced = commentResults.find(
            (result) => result.observationId === observation.id && result.commentId === comment.id,
          );
          return synced
            ? { ...comment, serverId: synced.server.id, sync: 'synced' as const }
            : comment;
        }),
      }));
      const syncedVisits = visitResults.map(({ item, server }) => ({
        ...item,
        serverId: server.id,
        sync: 'synced' as const,
      }));
      await Promise.all([
        ...finalizedObservations.map(persistObservation),
        ...syncedVisits.map(persistFieldVisit),
      ]);
      setObservations((current) =>
        current.map((item) => finalizedObservations.find((saved) => saved.id === item.id) ?? item),
      );
      setVisits((current) =>
        current.map((visit) => syncedVisits.find((saved) => saved.id === visit.id) ?? visit),
      );
      setSyncState('synced');
    } catch (error) {
      const failedObservations = queuedObservations.map((item) => ({
        ...item,
        sync: 'failed' as const,
      }));
      const failedVisits = queuedVisits.map((visit) => ({ ...visit, sync: 'failed' as const }));
      await Promise.all([
        ...failedObservations.map(persistObservation),
        ...failedVisits.map(persistFieldVisit),
      ]);
      setObservations((current) =>
        current.map((item) => failedObservations.find((saved) => saved.id === item.id) ?? item),
      );
      setVisits((current) =>
        current.map((visit) => failedVisits.find((saved) => saved.id === visit.id) ?? visit),
      );
      setSyncState('failed');
      setAccountError(error instanceof Error ? error.message : 'Sync failed.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{session?.projectName ?? 'RIVERSIDE RESIDENCES'}</Text>
          <Text style={styles.title}>{currentTab.title}</Text>
        </View>
        <Pressable style={styles.avatar} onPress={session ? disconnectAccount : connectAccount}>
          <Text style={styles.avatarText}>{session ? 'AM' : 'IN'}</Text>
        </Pressable>
      </View>
      {accountError && <Text style={styles.accountError}>{accountError}</Text>}
      <View
        style={[styles.syncBanner, syncState === 'synced' ? styles.syncOk : styles.syncPending]}
      >
        <Text style={styles.syncDot}>●</Text>
        <Text style={styles.syncText}>{syncCopy[syncState]}</Text>
        {syncState !== 'synced' && (
          <Pressable onPress={retrySync}>
            <Text style={styles.syncAction}>Sync now</Text>
          </Pressable>
        )}
      </View>
      {activeTab === 'home' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.visitCard}>
            <View>
              <Text style={styles.eyebrow}>TODAY'S SITE VISIT</Text>
              <Text style={styles.visitTitle}>Riverside site · 14 Mar</Text>
              <Text style={styles.visitMeta}>Clear · 2 attendees · 1 checklist item</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open field work"
              style={styles.visitButton}
              onPress={() => setActiveTab('field')}
            >
              <Text style={styles.visitButtonText}>Open</Text>
            </Pressable>
          </View>
          <View style={styles.summaryGrid}>
            <Pressable style={styles.summaryCard} onPress={() => setActiveTab('field')}>
              <Text style={styles.summaryValue}>{openCount}</Text>
              <Text style={styles.summaryLabel}>Open observations</Text>
            </Pressable>
            <Pressable style={styles.summaryCard} onPress={() => setActiveTab('tasks')}>
              <Text style={styles.summaryValue}>{openObservations.length}</Text>
              <Text style={styles.summaryLabel}>Tasks needing review</Text>
            </Pressable>
          </View>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent field activity</Text>
              <Text style={styles.sectionMeta}>Latest project records on this device</Text>
            </View>
          </View>
          {observations.slice(0, 2).map((observation) => (
            <ObservationCard observation={observation} key={observation.id} />
          ))}
        </ScrollView>
      )}
      {activeTab === 'field' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.visitCard}>
            <View>
              <Text style={styles.eyebrow}>TODAY'S SITE VISIT</Text>
              <Text style={styles.visitTitle}>Riverside site · 14 Mar</Text>
              <Text style={styles.visitMeta}>
                Start a local draft before connectivity is available
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Start site visit"
              accessibilityRole="button"
              style={styles.visitButton}
              onPress={() => setVisitCaptureOpen(true)}
            >
              <Text style={styles.visitButtonText}>Start</Text>
            </Pressable>
          </View>
          {visits.length > 0 && (
            <>
              <View style={styles.listHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Visit drafts</Text>
                  <Text style={styles.sectionMeta}>Saved locally until synchronized</Text>
                </View>
              </View>
              {visits.slice(0, 2).map((visit) => (
                <FieldVisitCard
                  key={visit.id}
                  visit={visit}
                  selectedObservationCount={selectedReportObservationIds.length}
                  onCreateReport={() => createReportFromVisit(visit)}
                />
              ))}
            </>
          )}
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Observations</Text>
              <Text style={styles.sectionMeta}>{openCount} open</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setActiveTab('tasks')}>
              <Text style={styles.filterText}>View tasks →</Text>
            </Pressable>
          </View>
          {observations.map((observation) => (
            <ObservationCard
              key={observation.id}
              observation={observation}
              {...(observation.serverId && observation.sync === 'synced'
                ? {
                    onCreateTask: () => createTaskFromObservation(observation),
                    onCreateRfi: () => createWorkflowFromObservation(observation, 'rfi'),
                    onCreateSiteInstruction: () =>
                      createWorkflowFromObservation(observation, 'site_instruction'),
                    onAddComment: () => setCommentObservationId(observation.id),
                    selectedForReport: selectedReportObservationIds.includes(observation.serverId),
                    onToggleReport: () => toggleReportObservation(observation),
                  }
                : {})}
            />
          ))}
        </ScrollView>
      )}
      {activeTab === 'tasks' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Open field tasks</Text>
              <Text style={styles.sectionMeta}>Created from synchronized field observations</Text>
            </View>
          </View>
          {linkedTaskObservations.map((observation) => (
            <ObservationCard observation={observation} key={observation.id} />
          ))}
          {linkedTaskObservations.length === 0 && (
            <Text style={styles.emptyState}>
              Sync an observation, then use “Create task” from Field to add it here.
            </Text>
          )}
        </ScrollView>
      )}
      {activeTab === 'more' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsCard}>
            <Text style={styles.eyebrow}>ACCOUNT</Text>
            <Text style={styles.settingsTitle}>
              {session ? session.projectName : 'Connect your Orbita account'}
            </Text>
            <Text style={styles.settingsCopy}>
              {session
                ? 'This device can sync field records to the selected project.'
                : 'Sign in to synchronize locally captured field observations.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.settingsAction}
              onPress={session ? disconnectAccount : connectAccount}
            >
              <Text style={styles.settingsActionText}>{session ? 'Sign out' : 'Sign in'}</Text>
            </Pressable>
          </View>
          <View style={styles.settingsCard}>
            <Text style={styles.eyebrow}>OFFLINE QUEUE</Text>
            <Text style={styles.settingsTitle}>{queuedCount} records waiting to sync</Text>
            <Text style={styles.settingsCopy}>{syncCopy[syncState]}</Text>
            {queuedCount > 0 && (
              <Pressable
                accessibilityRole="button"
                style={styles.settingsAction}
                onPress={retrySync}
              >
                <Text style={styles.settingsActionText}>Sync now</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}
      {activeTab === 'field' && (
        <Pressable
          accessibilityRole="button"
          style={styles.captureButton}
          onPress={() => setCaptureOpen(true)}
        >
          <Text style={styles.captureIcon}>＋</Text>
          <Text style={styles.captureText}>Capture observation</Text>
        </Pressable>
      )}
      {captureOpen && (
        <View style={styles.sheetBackdrop}>
          <View style={styles.captureSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New observation</Text>
            <Text style={styles.sheetCopy}>
              It is stored locally first. An authenticated project session is required before it can
              sync.
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              placeholder="What needs attention?"
              placeholderTextColor="#758181"
              style={styles.input}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setCaptureOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={captureObservation}
                style={[styles.saveButton, !title.trim() && styles.saveDisabled]}
              >
                <Text style={styles.saveText}>Save locally</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {commentObservationId && (
        <View style={styles.sheetBackdrop}>
          <View style={styles.captureSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add observation comment</Text>
            <Text style={styles.sheetCopy}>
              Comments are stored locally and added to the project discussion when this observation
              syncs.
            </Text>
            <TextInput
              value={commentBody}
              onChangeText={setCommentBody}
              autoFocus
              multiline
              placeholder="Add a site update or response"
              placeholderTextColor="#758181"
              style={[styles.input, styles.notesInput]}
            />
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setCommentObservationId(undefined)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const observation = observations.find((item) => item.id === commentObservationId);
                  if (observation) void addLocalComment(observation);
                }}
                style={[styles.saveButton, !commentBody.trim() && styles.saveDisabled]}
              >
                <Text style={styles.saveText}>Save locally</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {visitCaptureOpen && (
        <View style={styles.sheetBackdrop}>
          <ScrollView contentContainerStyle={styles.captureSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New site visit</Text>
            <Text style={styles.sheetCopy}>
              The visit is saved on this device first and can be synchronized when you sign in.
            </Text>
            <Text style={styles.inputLabel}>Visit date</Text>
            <TextInput
              value={visitDate}
              onChangeText={setVisitDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#758181"
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Site location</Text>
            <TextInput
              value={visitLocation}
              onChangeText={setVisitLocation}
              placeholder="Site or zone"
              placeholderTextColor="#758181"
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Attendees</Text>
            <TextInput
              value={visitAttendees}
              onChangeText={setVisitAttendees}
              placeholder="Comma-separated names"
              placeholderTextColor="#758181"
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Weather</Text>
            <TextInput
              value={visitWeather}
              onChangeText={setVisitWeather}
              placeholder="Clear, rain, hot…"
              placeholderTextColor="#758181"
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Checklist</Text>
            <TextInput
              value={visitChecklist}
              onChangeText={setVisitChecklist}
              placeholder="Comma-separated checklist items"
              placeholderTextColor="#758181"
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              value={visitNotes}
              onChangeText={setVisitNotes}
              multiline
              placeholder="What happened on site?"
              placeholderTextColor="#758181"
              style={[styles.input, styles.notesInput]}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setVisitCaptureOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={captureFieldVisit}
                style={[styles.saveButton, !visitLocation.trim() && styles.saveDisabled]}
              >
                <Text style={styles.saveText}>Save locally</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}
      <View accessibilityRole="tablist" style={styles.tabBar}>
        {mobileTabs.map((tab) => (
          <Tab
            active={tab.id === activeTab}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

function ObservationCard({
  observation,
  onCreateTask,
  onCreateRfi,
  onCreateSiteInstruction,
  onAddComment,
  selectedForReport = false,
  onToggleReport,
}: {
  observation: Observation;
  onCreateTask?: () => void;
  onCreateRfi?: () => void;
  onCreateSiteInstruction?: () => void;
  onAddComment?: () => void;
  selectedForReport?: boolean;
  onToggleReport?: () => void;
}) {
  return (
    <View style={styles.observationCard}>
      <View style={styles.observationTop}>
        <View style={styles.observationCode}>
          <View
            style={[
              styles.priorityDot,
              observation.priority === 'High'
                ? styles.priorityHigh
                : observation.priority === 'Medium'
                  ? styles.priorityMedium
                  : styles.priorityLow,
            ]}
          />
          <Text style={styles.observationId}>
            {observation.id} · {observation.area}
          </Text>
        </View>
        <Text style={styles.recordSync}>{observation.sync === 'synced' ? '✓' : '○'}</Text>
      </View>
      <Text style={styles.observationTitle}>{observation.title}</Text>
      <View style={styles.observationFooter}>
        <Text style={styles.priorityText}>{observation.priority}</Text>
        {observation.taskId ? (
          <Text style={styles.recordState}>Task created</Text>
        ) : (
          <Text style={styles.recordState}>{observation.state}</Text>
        )}
      </View>
      <Text style={styles.commentCount}>
        {observation.comments.length} discussion{' '}
        {observation.comments.length === 1 ? 'comment' : 'comments'}
      </Text>
      {onAddComment && (
        <Pressable accessibilityRole="button" onPress={onAddComment} style={styles.reportAction}>
          <Text style={styles.reportActionText}>Add comment</Text>
        </Pressable>
      )}
      {onCreateTask && !observation.taskId && (
        <Pressable accessibilityRole="button" onPress={onCreateTask} style={styles.taskAction}>
          <Text style={styles.taskActionText}>Create task</Text>
        </Pressable>
      )}
      {onCreateRfi && !observation.rfiId && (
        <Pressable accessibilityRole="button" onPress={onCreateRfi} style={styles.reportAction}>
          <Text style={styles.reportActionText}>Draft RFI</Text>
        </Pressable>
      )}
      {onCreateSiteInstruction && !observation.siteInstructionId && (
        <Pressable
          accessibilityRole="button"
          onPress={onCreateSiteInstruction}
          style={styles.reportAction}
        >
          <Text style={styles.reportActionText}>Draft instruction</Text>
        </Pressable>
      )}
      {onToggleReport && (
        <Pressable accessibilityRole="button" onPress={onToggleReport} style={styles.reportAction}>
          <Text style={styles.reportActionText}>
            {selectedForReport ? 'Included in report' : 'Include in report'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function FieldVisitCard({
  visit,
  selectedObservationCount,
  onCreateReport,
}: {
  visit: FieldVisit;
  selectedObservationCount: number;
  onCreateReport: () => void;
}) {
  return (
    <View style={styles.observationCard}>
      <View style={styles.observationTop}>
        <Text style={styles.observationId}>
          {visit.visitDate} · {visit.location}
        </Text>
        <Text style={styles.recordSync}>{visit.sync === 'synced' ? '✓' : '○'}</Text>
      </View>
      <Text style={styles.observationTitle}>{visit.attendees.length || 'No'} attendees</Text>
      <View style={styles.observationFooter}>
        <Text style={styles.priorityText}>{visit.weather || 'Weather not recorded'}</Text>
        <Text style={styles.recordState}>{visit.checklist.length} checklist items</Text>
      </View>
      {visit.reportId ? (
        <Text style={styles.reportReady}>Report draft ready for review</Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={onCreateReport} style={styles.reportAction}>
          <Text style={styles.reportActionText}>
            Draft report ({selectedObservationCount} selected)
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Tab({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${label}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7fbfa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.1, fontWeight: '700', color: '#73807e' },
  title: {
    marginTop: 4,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontWeight: '700',
    color: '#172521',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9ac73',
  },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#39240a' },
  accountError: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    fontSize: 11,
    color: '#8b3428',
    backgroundColor: '#fff0ed',
  },
  syncBanner: {
    minHeight: 36,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  syncOk: { backgroundColor: '#e6f4ee' },
  syncPending: { backgroundColor: '#fff3da' },
  syncDot: { color: '#20765e', fontSize: 9 },
  syncText: { flex: 1, fontSize: 11, color: '#315c51', fontWeight: '600' },
  syncAction: { color: '#176b58', fontSize: 11, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 98 },
  summaryGrid: { marginTop: 12, flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dce8e4',
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  summaryValue: { fontSize: 23, fontWeight: '800', color: '#1d2b27' },
  summaryLabel: { marginTop: 4, fontSize: 10, lineHeight: 14, color: '#6f7e7a', fontWeight: '600' },
  visitCard: {
    borderWidth: 1,
    borderColor: '#dce8e4',
    borderRadius: 11,
    padding: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitTitle: { marginTop: 5, fontSize: 14, fontWeight: '700', color: '#1d2b27' },
  visitMeta: { marginTop: 4, fontSize: 11, color: '#6f7e7a' },
  visitButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#e8f4ee',
  },
  visitButtonText: { color: '#176b58', fontSize: 11, fontWeight: '700' },
  listHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1d2b27' },
  sectionMeta: { marginTop: 2, fontSize: 11, color: '#72807c' },
  filterText: { color: '#176b58', fontSize: 12, fontWeight: '700' },
  observationCard: {
    padding: 13,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#e0e9e6',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  observationTop: { flexDirection: 'row', justifyContent: 'space-between' },
  observationCode: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityHigh: { backgroundColor: '#d86d57' },
  priorityMedium: { backgroundColor: '#d99c3c' },
  priorityLow: { backgroundColor: '#5e9bd0' },
  observationId: { fontSize: 10, color: '#75827f', fontWeight: '600' },
  recordSync: { color: '#39876d', fontWeight: '700' },
  observationTitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 19,
    color: '#22302c',
    fontWeight: '700',
  },
  observationFooter: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#edf1ef',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityText: { fontSize: 10, color: '#77837f' },
  recordState: { fontSize: 10, color: '#236b59', fontWeight: '700' },
  commentCount: { marginTop: 9, color: '#75827f', fontSize: 10 },
  taskAction: {
    alignSelf: 'flex-start',
    marginTop: 11,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#e8f4ee',
  },
  taskActionText: { color: '#176b58', fontSize: 10, fontWeight: '800' },
  reportAction: {
    alignSelf: 'flex-start',
    marginTop: 11,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#edf6f3',
  },
  reportActionText: { color: '#176b58', fontSize: 10, fontWeight: '800' },
  reportReady: { marginTop: 11, color: '#176b58', fontSize: 10, fontWeight: '800' },
  emptyState: { paddingTop: 8, color: '#6f7e7a', fontSize: 12, lineHeight: 18 },
  captureButton: {
    position: 'absolute',
    right: 18,
    bottom: 75,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#176b58',
    shadowColor: '#0d3e32',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  captureIcon: { color: '#fff', fontSize: 16, lineHeight: 17 },
  captureText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabBar: {
    height: 63,
    paddingHorizontal: 25,
    borderTopWidth: 1,
    borderTopColor: '#e1ebe7',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tab: { alignItems: 'center', gap: 2, minWidth: 35 },
  tabPressed: { opacity: 0.56 },
  tabIcon: { fontSize: 16, color: '#7b8884' },
  tabLabel: { fontSize: 9, color: '#7b8884' },
  tabActive: { color: '#176b58', fontWeight: '800' },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 34, 30, .35)',
  },
  captureSheet: {
    padding: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#fff',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 35,
    height: 4,
    marginBottom: 18,
    borderRadius: 4,
    backgroundColor: '#d8e1de',
  },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: '#172521' },
  sheetCopy: { marginTop: 5, fontSize: 12, lineHeight: 18, color: '#71807b' },
  inputLabel: { marginTop: 14, fontSize: 11, color: '#53645f', fontWeight: '700' },
  input: {
    marginTop: 6,
    minHeight: 47,
    borderWidth: 1,
    borderColor: '#cddbd6',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#1d2b27',
    fontSize: 14,
  },
  notesInput: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' },
  sheetActions: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelButton: { paddingVertical: 11, paddingHorizontal: 13 },
  cancelText: { color: '#5f706a', fontSize: 12, fontWeight: '700' },
  saveButton: {
    borderRadius: 7,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#176b58',
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  settingsCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dce8e4',
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  settingsTitle: { marginTop: 7, fontSize: 16, color: '#1d2b27', fontWeight: '700' },
  settingsCopy: { marginTop: 5, fontSize: 12, lineHeight: 18, color: '#6f7e7a' },
  settingsAction: {
    alignSelf: 'flex-start',
    marginTop: 15,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#e8f4ee',
  },
  settingsActionText: { color: '#176b58', fontSize: 12, fontWeight: '800' },
});
