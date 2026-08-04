import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  type MobileSession,
  restoreSession,
  signIn,
  signOut,
  submitObservation,
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
type Observation = {
  id: string;
  title: string;
  area: string;
  priority: 'High' | 'Medium' | 'Low';
  state: 'Open' | 'In review' | 'Closed';
  sync: SyncState;
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
  return database;
}

async function loadLocalObservations() {
  const database = await initializeFieldStore();
  const rows = await database.getAllAsync<{ payload: string }>(
    'SELECT payload FROM local_observations ORDER BY updated_at DESC',
  );
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload) as Observation];
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

const initialObservations: Observation[] = [
  {
    id: 'SO-018',
    title: 'Parapet waterproofing continuity',
    area: 'Roof level',
    priority: 'High',
    state: 'Open',
    sync: 'synced',
  },
  {
    id: 'SO-017',
    title: 'Window sill level at unit 2B',
    area: 'Level 2',
    priority: 'Medium',
    state: 'In review',
    sync: 'synced',
  },
  {
    id: 'SO-016',
    title: 'Temporary edge protection',
    area: 'Level 4',
    priority: 'High',
    state: 'Closed',
    sync: 'synced',
  },
];

const syncCopy: Record<SyncState, string> = {
  local: 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'All changes synced',
  failed: 'Sync failed — retry required',
  conflict: 'Conflict needs review',
};

export default function HomeScreen() {
  const [observations, setObservations] = useState(initialObservations);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [session, setSession] = useState<MobileSession>();
  const [accountError, setAccountError] = useState<string>();
  const openCount = useMemo(
    () => observations.filter((item) => item.state !== 'Closed').length,
    [observations],
  );

  useEffect(() => {
    let active = true;
    loadLocalObservations()
      .then((stored) => {
        if (!active || stored.length === 0) return;
        setObservations((current) => [
          ...stored,
          ...current.filter((item) => !stored.some((saved) => saved.id === item.id)),
        ]);
        if (stored.some((item) => item.sync !== 'synced')) setSyncState('local');
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
    };
    setObservations((current) => [localRecord, ...current]);
    await persistObservation(localRecord);
    setSyncState('local');
    setTitle('');
    setCaptureOpen(false);
  };
  const retrySync = async () => {
    if (!session) {
      setAccountError('Sign in before syncing field captures.');
      setSyncState('failed');
      return;
    }
    setSyncState('syncing');
    const queued = observations.filter((item) => item.sync !== 'synced');
    try {
      await Promise.all(queued.map((item) => submitObservation(session, item)));
      const synced = queued.map((item) => ({ ...item, sync: 'synced' as const }));
      await Promise.all(synced.map(persistObservation));
      setObservations((current) =>
        current.map((item) => synced.find((saved) => saved.id === item.id) ?? item),
      );
      setSyncState('synced');
    } catch (error) {
      const failed = queued.map((item) => ({ ...item, sync: 'failed' as const }));
      await Promise.all(failed.map(persistObservation));
      setObservations((current) =>
        current.map((item) => failed.find((saved) => saved.id === item.id) ?? item),
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
          <Text style={styles.title}>Field work</Text>
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.visitCard}>
          <View>
            <Text style={styles.eyebrow}>TODAY'S SITE VISIT</Text>
            <Text style={styles.visitTitle}>Riverside site · 14 Mar</Text>
            <Text style={styles.visitMeta}>Clear · 2 attendees · 1 checklist item</Text>
          </View>
          <Pressable style={styles.visitButton}>
            <Text style={styles.visitButtonText}>Open</Text>
          </Pressable>
        </View>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Observations</Text>
            <Text style={styles.sectionMeta}>{openCount} open</Text>
          </View>
          <Pressable>
            <Text style={styles.filterText}>Filter ▾</Text>
          </Pressable>
        </View>
        {observations.map((observation) => (
          <View style={styles.observationCard} key={observation.id}>
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
              <Text style={styles.recordState}>{observation.state}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        style={styles.captureButton}
        onPress={() => setCaptureOpen(true)}
      >
        <Text style={styles.captureIcon}>＋</Text>
        <Text style={styles.captureText}>Capture observation</Text>
      </Pressable>
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
      <View style={styles.tabBar}>
        <Tab icon="⌂" label="Home" />
        <Tab icon="⌖" label="Field" active />
        <Tab icon="☷" label="Tasks" />
        <Tab icon="◉" label="More" />
      </View>
    </SafeAreaView>
  );
}

function Tab({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  return (
    <View style={styles.tab}>
      <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </View>
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
  input: {
    marginTop: 18,
    minHeight: 47,
    borderWidth: 1,
    borderColor: '#cddbd6',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#1d2b27',
    fontSize: 14,
  },
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
});
