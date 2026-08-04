'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  fileProjectCommunication,
  loadProjectRecord,
  restoreLocalLogin,
  type ProjectRecord,
  type Viewer,
} from '../../../local-auth';

export function CommunicationRecordWorkspace({ projectId, communicationId }: { projectId: string; communicationId: string }) {
  const [record, setRecord] = useState<ProjectRecord>();
  const [viewer, setViewer] = useState<Viewer>();
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string>();
  const [working, setWorking] = useState(false);
  const refresh = async () => setRecord(await loadProjectRecord(projectId));
  useEffect(() => { void (async () => { try { setViewer(await restoreLocalLogin()); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Communication could not be loaded.'); } })(); }, [projectId]);
  const communication = record?.communications.find((item) => item.id === communicationId);
  const thread = communication && record ? record.communications.filter((item) => (communication.thread_id ? item.thread_id === communication.thread_id : item.id === communication.id)) : [];
  const fileFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!communication || !viewer || !body.trim()) return;
    setWorking(true);
    try {
      await fileProjectCommunication(projectId, { channel: 'manual_note', direction: 'internal', subject: communication.subject, body: body.trim(), sender: viewer.displayName ?? viewer.userId, recipients: communication.recipients, threadId: communication.thread_id ?? communication.id });
      setBody('');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow-up could not be filed.'); } finally { setWorking(false); }
  };
  if (!communication) return <main className="record-page"><p className="settings-empty">{message ?? 'Loading communication…'}</p></main>;
  return <main className="record-page" aria-label={`Communication ${communication.subject}`}>
    <header className="record-page-header"><div><Link href="/" className="back-link">← Back to workspace</Link><p className="eyebrow">PROJECT COMMUNICATION</p><h1>{communication.subject}</h1><p>{communication.channel} · {communication.direction} · filed {new Date(communication.filed_at).toLocaleString()}</p></div><span className="status-pill current">filed</span></header>
    {message && <p className="form-message">{message}</p>}
    <section className="content-card record-page-card"><div className="record-grid"><div><span>From</span><strong>{communication.sender}</strong></div><div><span>Recipients</span><strong>{communication.recipients.join(', ') || 'Internal record'}</strong></div><div><span>Channel</span><strong>{communication.channel}</strong></div><div><span>Thread</span><strong>{thread.length} entries</strong></div></div></section>
    <section className="content-card record-page-card task-discussion" aria-label="Communication thread"><div className="card-header"><div><p className="eyebrow">THREAD</p><h2>Conversation record</h2></div><span>{thread.length} entries</span></div><div className="comment-list">{thread.map((item) => <article key={item.id}><strong>{item.sender}</strong><time dateTime={item.filed_at}>{new Date(item.filed_at).toLocaleString()}</time><p>{item.body}</p><small>{item.channel} · {item.direction}</small></article>)}</div>{viewer && <form className="task-comment-form" onSubmit={fileFollowUp}><label>File an internal follow-up<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={20000} placeholder="Record the decision or next step…" required /></label><button className="button-primary" disabled={working} type="submit">File follow-up</button></form>}</section>
  </main>;
}
