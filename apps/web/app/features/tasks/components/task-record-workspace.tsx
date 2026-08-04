'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  createTaskComment,
  loadProjectRecord,
  loadTaskComments,
  restoreLocalLogin,
  transitionProjectTask,
  type ProjectRecord,
  type TaskComment,
} from '../../../local-auth';

type TaskRecordWorkspaceProps = { projectId: string; taskId: string };

export function TaskRecordWorkspace({ projectId, taskId }: TaskRecordWorkspaceProps) {
  const [record, setRecord] = useState<ProjectRecord>();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [message, setMessage] = useState<string>();
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    const next = await loadProjectRecord(projectId);
    setRecord(next);
    const task = next.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('This task is unavailable.');
    setComments(await loadTaskComments(projectId, taskId));
  };
  useEffect(() => {
    void (async () => {
      try {
        await restoreLocalLogin();
        await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Task record could not be loaded.');
      }
    })();
  }, [projectId, taskId]);

  const task = record?.tasks.find((item) => item.id === taskId);
  const setStatus = async (status: 'in_progress' | 'blocked' | 'completed') => {
    if (!task) return;
    setWorking(true);
    setMessage(undefined);
    try {
      await transitionProjectTask(projectId, task.id, status);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task status could not be updated.');
    } finally {
      setWorking(false);
    }
  };
  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentBody.trim()) return;
    setWorking(true);
    try {
      const comment = await createTaskComment(projectId, taskId, commentBody.trim());
      setComments((current) => [...current, comment]);
      setCommentBody('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task comment could not be saved.');
    } finally {
      setWorking(false);
    }
  };

  if (!task) return <main className="record-page"><p className="settings-empty">{message ?? 'Loading task…'}</p></main>;
  const canTransition = !['completed', 'cancelled'].includes(task.status);
  return (
    <main className="record-page" aria-label={`Task record ${task.title}`}>
      <header className="record-page-header">
        <div>
          <Link href="/" className="back-link">← Back to workspace</Link>
          <p className="eyebrow">PROJECT TASK</p>
          <h1>{task.title}</h1>
          <p>Keep the decision trail and the next action together.</p>
        </div>
        <span className="status-pill current">{task.status.replaceAll('_', ' ')}</span>
      </header>
      {message && <p className="form-message">{message}</p>}
      <section className="content-card record-page-card">
        <div className="record-grid">
          <div><span>Priority</span><strong>{task.priority}</strong></div>
          <div><span>Assignee</span><strong>{task.assignee_id ?? 'Unassigned'}</strong></div>
          <div><span>Due</span><strong>{task.due_date ?? 'Not scheduled'}</strong></div>
          <div><span>Project</span><strong>{record?.project.code}</strong></div>
        </div>
        {canTransition && <div className="detail-action-row">
          {task.status === 'open' && <button className="button-secondary" disabled={working} onClick={() => void setStatus('in_progress')}>Start work</button>}
          {task.status !== 'blocked' && <button className="button-secondary" disabled={working} onClick={() => void setStatus('blocked')}>Mark blocked</button>}
          {task.status === 'blocked' && <button className="button-secondary" disabled={working} onClick={() => void setStatus('in_progress')}>Resume work</button>}
          <button className="button-primary" disabled={working} onClick={() => void setStatus('completed')}>Complete task</button>
        </div>}
      </section>
      <section className="content-card record-page-card task-discussion" aria-label="Task discussion">
        <div className="card-header"><div><p className="eyebrow">DISCUSSION</p><h2>Project conversation</h2></div><span>{comments.length} comments</span></div>
        {comments.length ? <div className="comment-list">{comments.map((comment) => <article key={comment.id}><strong>{comment.created_by}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time><p>{comment.body}</p></article>)}</div> : <p className="settings-empty">No discussion yet. Record the next decision or question.</p>}
        <form className="task-comment-form" onSubmit={addComment}><label>Add a comment<textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={4000} placeholder="Share a decision, constraint, or follow-up…" required /></label><button className="button-primary" disabled={working} type="submit">Post comment</button></form>
      </section>
    </main>
  );
}
