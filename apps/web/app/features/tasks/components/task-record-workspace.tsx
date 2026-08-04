'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  beginLocalLogin,
  createTaskComment,
  loadProjectRecord,
  loadTaskComments,
  restoreLocalLogin,
  transitionProjectTask,
  updateProjectTask,
  type ProjectRecord,
  type TaskComment,
} from '../../../local-auth';

type TaskRecordWorkspaceProps = { projectId: string; taskId: string };

export function TaskRecordWorkspace({ projectId, taskId }: TaskRecordWorkspaceProps) {
  const [record, setRecord] = useState<ProjectRecord>();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [message, setMessage] = useState<string>();
  const [signInRequired, setSignInRequired] = useState(false);
  const [working, setWorking] = useState(false);
  const [editingField, setEditingField] = useState<'title' | 'priority' | 'dueDate' | 'assignee'>();
  const [fieldValue, setFieldValue] = useState('');

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
        const viewer = await restoreLocalLogin();
        if (!viewer) {
          setSignInRequired(true);
          return;
        }
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
  const beginFieldEdit = (field: 'title' | 'priority' | 'dueDate' | 'assignee') => {
    if (!task) return;
    setFieldValue(field === 'title' ? task.title : field === 'priority' ? task.priority : field === 'dueDate' ? task.due_date ?? '' : task.assignee_id ?? '');
    setEditingField(field);
  };
  const saveField = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task || !editingField) return;
    setWorking(true);
    setMessage(undefined);
    try {
      const update = editingField === 'title' ? { title: fieldValue.trim() }
        : editingField === 'priority' ? { priority: fieldValue }
        : editingField === 'dueDate' ? (fieldValue ? { dueDate: fieldValue } : { clearDueDate: true })
        : (fieldValue ? { assigneeId: fieldValue } : { clearAssignee: true });
      await updateProjectTask(projectId, task.id, update);
      await refresh();
      setEditingField(undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task could not be updated.');
    } finally {
      setWorking(false);
    }
  };

  if (signInRequired) return <main className="record-page"><section className="content-card record-page-card auth-required"><p className="eyebrow">PRIVATE PROJECT RECORD</p><h1>Sign in to view this task</h1><p>Your access is checked before Orbita loads project work.</p><button className="button-primary" onClick={() => void beginLocalLogin()}>Sign in</button></section></main>;
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
          <div><span>Title</span><strong>{task.title}</strong><button className="field-edit-button" aria-label="Edit task title" disabled={working} onClick={() => beginFieldEdit('title')}>✎</button></div>
          <div><span>Priority</span><strong>{task.priority}</strong><button className="field-edit-button" aria-label="Edit task priority" disabled={working} onClick={() => beginFieldEdit('priority')}>✎</button></div>
          <div><span>Assignee</span><strong>{record!.members.find((member) => member.user_id === task.assignee_id)?.display_name ?? task.assignee_id ?? 'Unassigned'}</strong><button className="field-edit-button" aria-label="Edit task assignee" disabled={working} onClick={() => beginFieldEdit('assignee')}>✎</button></div>
          <div><span>Due</span><strong>{task.due_date ?? 'Not scheduled'}</strong><button className="field-edit-button" aria-label="Edit task due date" disabled={working} onClick={() => beginFieldEdit('dueDate')}>✎</button></div>
          <div><span>Project</span><strong>{record?.project.code}</strong></div>
        </div>
        {canTransition && <div className="detail-action-row">
          {task.status === 'open' && <button className="button-secondary" disabled={working} onClick={() => void setStatus('in_progress')}>Start work</button>}
          {task.status !== 'blocked' && <button className="button-secondary" disabled={working} onClick={() => void setStatus('blocked')}>Mark blocked</button>}
          {task.status === 'blocked' && <button className="button-secondary" disabled={working} onClick={() => void setStatus('in_progress')}>Resume work</button>}
          <button className="button-primary" disabled={working} onClick={() => void setStatus('completed')}>Complete task</button>
        </div>}
        {editingField && <form className="proposal-builder task-edit-form" onSubmit={saveField}>
          {editingField === 'title' && <label>Task title<input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} minLength={2} required /></label>}
          {editingField === 'priority' && <label>Task priority<select value={fieldValue} onChange={(event) => setFieldValue(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>}
          {editingField === 'dueDate' && <label>Task due date<input type="date" value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} /></label>}
          {editingField === 'assignee' && <label>Task assignee<select value={fieldValue} onChange={(event) => setFieldValue(event.target.value)}><option value="">Unassigned</option>{record!.members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name ?? member.user_id}</option>)}</select></label>}
          <div className="detail-action-row"><button className="button-primary" disabled={working} type="submit">Save {editingField === 'dueDate' ? 'due date' : editingField}</button><button className="button-secondary" type="button" onClick={() => setEditingField(undefined)}>Cancel</button></div>
        </form>}
      </section>
      <section className="content-card record-page-card task-discussion" aria-label="Task discussion">
        <div className="card-header"><div><p className="eyebrow">DISCUSSION</p><h2>Project conversation</h2></div><span>{comments.length} comments</span></div>
        {comments.length ? <div className="comment-list">{comments.map((comment) => <article key={comment.id}><strong>{comment.created_by}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time><p>{comment.body}</p></article>)}</div> : <p className="settings-empty">No discussion yet. Record the next decision or question.</p>}
        <form className="task-comment-form" onSubmit={addComment}><label>Add a comment<textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={4000} placeholder="Share a decision, constraint, or follow-up…" required /></label><button className="button-primary" disabled={working} type="submit">Post comment</button></form>
      </section>
    </main>
  );
}
