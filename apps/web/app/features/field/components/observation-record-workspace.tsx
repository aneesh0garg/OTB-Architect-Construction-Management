'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  createObservationComment,
  loadObservationComments,
  loadObservationDetail,
  restoreLocalLogin,
  type ObservationComment,
  type ObservationDetail,
} from '../../../local-auth';

export function ObservationRecordWorkspace({ projectId, observationId }: { projectId: string; observationId: string }) {
  const [observation, setObservation] = useState<ObservationDetail>();
  const [comments, setComments] = useState<ObservationComment[]>([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string>();
  const [working, setWorking] = useState(false);
  useEffect(() => { void (async () => { try { await restoreLocalLogin(); const [item, notes] = await Promise.all([loadObservationDetail(projectId, observationId), loadObservationComments(projectId, observationId)]); setObservation(item); setComments(notes); } catch (error) { setMessage(error instanceof Error ? error.message : 'Observation could not be loaded.'); } })(); }, [projectId, observationId]);
  const addComment = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!body.trim()) return; setWorking(true); try { const comment = await createObservationComment(projectId, observationId, body.trim()); setComments((current) => [...current, comment]); setBody(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Observation comment could not be saved.'); } finally { setWorking(false); } };
  if (!observation) return <main className="record-page"><p className="settings-empty">{message ?? 'Loading observation…'}</p></main>;
  return <main className="record-page" aria-label={`Observation SO-${observation.observation_number}`}>
    <header className="record-page-header"><div><Link href="/" className="back-link">← Back to workspace</Link><p className="eyebrow">FIELD OBSERVATION</p><h1>SO-{observation.observation_number} · {observation.title}</h1><p>{observation.location ?? 'Location not recorded'} · captured {new Date(observation.created_at).toLocaleString()}</p></div><span className="status-pill current">{observation.status}</span></header>
    {message && <p className="form-message">{message}</p>}
    <section className="content-card record-page-card"><p>{observation.description || 'No description recorded.'}</p><div className="record-grid"><div><span>Priority</span><strong>{observation.priority}</strong></div><div><span>Assignee</span><strong>{observation.assignee_name ?? observation.assignee_id ?? 'Unassigned'}</strong></div><div><span>Due</span><strong>{observation.due_date ?? 'Not scheduled'}</strong></div><div><span>Sync</span><strong>{observation.sync_state}</strong></div><div><span>Trade</span><strong>{observation.trade ?? 'Unspecified'}</strong></div><div><span>Area</span><strong>{[observation.floor, observation.zone].filter(Boolean).join(' · ') || 'Unspecified'}</strong></div></div></section>
    <section className="content-card record-page-card"><div className="card-header"><div><p className="eyebrow">EVIDENCE</p><h2>Captured evidence</h2></div><span>{observation.evidence.length}</span></div>{observation.evidence.length ? <pre className="evidence-preview">{JSON.stringify(observation.evidence, null, 2)}</pre> : <p className="settings-empty">No evidence attached.</p>}</section>
    <section className="content-card record-page-card task-discussion" aria-label="Observation discussion"><div className="card-header"><div><p className="eyebrow">DISCUSSION</p><h2>Site coordination</h2></div><span>{comments.length} comments</span></div>{comments.length ? <div className="comment-list">{comments.map((comment) => <article key={comment.id}><strong>{comment.created_by_display_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time><p>{comment.body}</p></article>)}</div> : <p className="settings-empty">No discussion yet. Record a decision or site response.</p>}<form className="task-comment-form" onSubmit={addComment}><label>Add a comment<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Share a site decision or follow-up…" required /></label><button className="button-primary" disabled={working} type="submit">Post comment</button></form></section>
  </main>;
}
