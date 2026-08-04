'use client';

import Link from 'next/link';
import { type FormEvent, type MouseEvent, useEffect, useState } from 'react';
import {
  beginLocalLogin,
  createDocumentAnnotation,
  issueProjectDocument,
  loadDocumentAnnotations,
  loadProjectRecord,
  prepareDocumentDownload,
  restoreLocalLogin,
  reviewProjectDocument,
  type DocumentAnnotation,
  type ProjectRecord,
} from '../../../local-auth';

type DocumentRecordWorkspaceProps = {
  projectId: string;
  documentId: string;
};

function MarkupLocator({
  comments,
  pinX,
  pinY,
  onSelect,
}: {
  comments: DocumentAnnotation[];
  pinX: number;
  pinY: number;
  onSelect: (x: number, y: number) => void;
}) {
  const selectPosition = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onSelect(
      Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    );
  };
  return <div className="markup-locator"><div><p className="eyebrow">MARKUP LOCATOR</p><strong>Drawing coordinate map</strong><p>Use this map to place a pin when the source is a multi-page PDF.</p></div><button type="button" className="markup-map" aria-label="Place markup on drawing map" onClick={selectPosition}>{comments.filter((comment) => comment.x_percent !== null && comment.y_percent !== null).map((comment, index) => <span key={comment.id} className="drawing-markup-pin" style={{ left: `${comment.x_percent}%`, top: `${comment.y_percent}%` }}>{index + 1}</span>)}<span className="drawing-markup-pin drawing-markup-preview" style={{ left: `${pinX}%`, top: `${pinY}%` }}>+</span></button></div>;
}

export function DocumentRecordWorkspace({ projectId, documentId }: DocumentRecordWorkspaceProps) {
  const [record, setRecord] = useState<ProjectRecord>();
  const [comments, setComments] = useState<DocumentAnnotation[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [pinX, setPinX] = useState(50);
  const [pinY, setPinY] = useState(50);
  const [originalUrl, setOriginalUrl] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [signInRequired, setSignInRequired] = useState(false);
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    const nextRecord = await loadProjectRecord(projectId);
    setRecord(nextRecord);
    const document = nextRecord.documents.find((item) => item.id === documentId);
    if (!document) throw new Error('This controlled document is unavailable.');
    const [annotations, original] = await Promise.all([
      loadDocumentAnnotations(projectId, documentId),
      document.has_original
        ? prepareDocumentDownload(projectId, documentId).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    setComments(annotations);
    setOriginalUrl(original?.downloadUrl);
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
        setMessage(error instanceof Error ? error.message : 'Document record could not be loaded.');
      }
    })();
  }, [projectId, documentId]);

  const document = record?.documents.find((item) => item.id === documentId);
  const review = async (action: 'submit' | 'approve' | 'reject') => {
    if (!document) return;
    setWorking(true);
    setMessage(undefined);
    try {
      await reviewProjectDocument(projectId, document.id, action);
      await refresh();
      setMessage(`Revision ${action === 'submit' ? 'submitted for review' : action === 'approve' ? 'approved' : 'returned to draft'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Document review could not be recorded.');
    } finally {
      setWorking(false);
    }
  };
  const issue = async () => {
    if (!document) return;
    setWorking(true);
    setMessage(undefined);
    try {
      await issueProjectDocument(projectId, document.id);
      await refresh();
      setMessage('Revision issued. Earlier issued revisions with this document number are superseded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Document revision could not be issued.');
    } finally {
      setWorking(false);
    }
  };
  const openOriginal = async () => {
    if (!document) return;
    setWorking(true);
    setMessage(undefined);
    try {
      const download = await prepareDocumentDownload(projectId, document.id);
      setOriginalUrl(download.downloadUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This revision has no downloadable original.');
    } finally {
      setWorking(false);
    }
  };
  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentBody.trim()) return;
    setWorking(true);
    try {
      const comment = await createDocumentAnnotation(projectId, documentId, {
        body: commentBody.trim(),
        ...(document?.document_type === 'drawing' ? { xPercent: pinX, yPercent: pinY } : {}),
      });
      setComments((current) => [...current, comment]);
      setCommentBody('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Document comment could not be saved.');
    } finally {
      setWorking(false);
    }
  };

  if (signInRequired) {
    return <main className="record-page"><section className="content-card record-page-card auth-required"><p className="eyebrow">PRIVATE PROJECT RECORD</p><h1>Sign in to view this document</h1><p>Your access is checked before Orbita loads controlled project records.</p><button className="button-primary" onClick={() => void beginLocalLogin()}>Sign in</button></section></main>;
  }
  if (!document) {
    return <main className="record-page"><p className="settings-empty">{message ?? 'Loading controlled record…'}</p></main>;
  }
  const linkedTransmittals = record?.transmittals.filter((item) => item.document_ids.includes(document.id)) ?? [];
  const isDrawing = document.document_type === 'drawing';
  const originalIsImage = originalUrl ? /\.(jpe?g|png|webp|svg)(\?|$)/i.test(new URL(originalUrl).pathname) : false;
  const originalIsPdf = originalUrl ? /\.pdf(\?|$)/i.test(new URL(originalUrl).pathname) : false;
  const setPinFromSurface = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPinX(Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)));
    setPinY(Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)));
  };

  return (
    <main className="record-page" aria-label={`Document record ${document.document_number}`}>
      <header className="record-page-header">
        <div>
          <Link href="/" className="back-link">← Back to workspace</Link>
          <p className="eyebrow">CONTROLLED DOCUMENT RECORD</p>
          <h1>{document.document_number} · Rev {document.revision}</h1>
          <p>{document.title}</p>
        </div>
        <span className="status-pill current">{document.status.replaceAll('_', ' ')}</span>
      </header>
      {message && <p className="form-message">{message}</p>}
      <section className="content-card record-page-card">
        <div className="record-grid">
          <div><span>Type</span><strong>{document.document_type}</strong></div>
          <div><span>Issued</span><strong>{document.issue_date ?? 'Not issued'}</strong></div>
          <div><span>Discipline</span><strong>{document.discipline ?? 'Unspecified'}</strong></div>
          <div><span>Original</span><strong>{document.has_original ? 'Retained' : 'Metadata only'}</strong></div>
        </div>
        <div className="detail-action-row">
          {document.has_original && <button className="button-secondary" disabled={working} onClick={() => void openOriginal()}>View original</button>}
          {document.status === 'draft' && <button className="button-secondary" disabled={working} onClick={() => void review('submit')}>Submit for review</button>}
          {document.status === 'internal_review' && <><button className="button-secondary" disabled={working} onClick={() => void review('approve')}>Approve</button><button className="button-secondary" disabled={working} onClick={() => void review('reject')}>Return to draft</button></>}
          {['draft', 'approved'].includes(document.status) && <button className="button-primary" disabled={working} onClick={() => void issue()}>Issue revision</button>}
        </div>
      </section>
      {originalUrl && <section className="content-card original-workspace" aria-label="Document original viewer">
        <div className="card-header"><div><p className="eyebrow">CONTROLLED ORIGINAL</p><h2>{isDrawing ? 'Drawing viewer' : 'Document viewer'}</h2><p>{isDrawing ? 'Select a location to position the next markup.' : 'The retained original for this controlled revision.'}</p></div><a href={originalUrl} target="_blank" rel="noreferrer">Open in browser ↗</a></div>
        {originalIsImage ? <button type="button" className="drawing-visual-surface" aria-label="Place markup on drawing" onClick={isDrawing ? setPinFromSurface : undefined}><img src={originalUrl} alt={document.title} />{isDrawing && comments.filter((comment) => comment.x_percent !== null && comment.y_percent !== null).map((comment, index) => <span key={comment.id} className="drawing-markup-pin" style={{ left: `${comment.x_percent}%`, top: `${comment.y_percent}%` }} aria-label={`Markup ${index + 1}`}>{index + 1}</span>)}{isDrawing && <span className="drawing-markup-pin drawing-markup-preview" style={{ left: `${pinX}%`, top: `${pinY}%` }} aria-label="Next markup position">+</span>}</button> : originalIsPdf ? <><a className="mobile-pdf-open" href={originalUrl} target="_blank" rel="noreferrer">Open full PDF — all pages ↗</a><iframe title={document.title} src={originalUrl} />{isDrawing && <MarkupLocator comments={comments} pinX={pinX} pinY={pinY} onSelect={(x, y) => { setPinX(x); setPinY(y); }} />}</> : <div className="native-document-notice"><strong>Native source file retained</strong><p>This format is controlled, revisioned, and ready to download. Open it in its authoring or coordination application for full fidelity.</p><a className="button-primary" href={originalUrl} target="_blank" rel="noreferrer">Download original ↗</a></div>}
      </section>}
      <section className="content-card record-page-card">
        <div className="card-header"><div><p className="eyebrow">ISSUANCE</p><h2>Transmittals</h2></div><span>{linkedTransmittals.length}</span></div>
        {linkedTransmittals.length ? <div className="simple-record-list">{linkedTransmittals.map((item) => <article key={item.id}><strong>Transmittal #{item.transmittal_number}</strong><span>{item.purpose}</span><small>{item.recipients.join(', ')}</small></article>)}</div> : <p className="settings-empty">This revision has not been included in a transmittal.</p>}
      </section>
      <section className="content-card record-page-card task-discussion" aria-label={isDrawing ? 'Drawing markups' : 'Document discussion'}>
        <div className="card-header"><div><p className="eyebrow">{isDrawing ? 'MARKUPS' : 'DISCUSSION'}</p><h2>{isDrawing ? 'Drawing review' : 'Record conversation'}</h2></div><span>{comments.length} comments</span></div>
        {comments.length ? <div className="comment-list">{comments.map((comment, index) => <article key={comment.id}>{isDrawing && comment.x_percent !== null && <span className="markup-list-index">{index + 1}</span>}<strong>{comment.created_by_display_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time><p>{comment.body}</p>{isDrawing && comment.x_percent !== null && <small>Pin: {Math.round(comment.x_percent)}% across · {Math.round(comment.y_percent ?? 0)}% down</small>}</article>)}</div> : <p className="settings-empty">No discussion yet. Record a decision, question, or review context.</p>}
        <form className="task-comment-form" onSubmit={addComment}>
          {isDrawing && <div className="pin-position-controls"><label>Horizontal <input aria-label="Markup horizontal position" type="range" min="0" max="100" value={pinX} onChange={(event) => setPinX(Number(event.target.value))} /><span>{pinX}%</span></label><label>Vertical <input aria-label="Markup vertical position" type="range" min="0" max="100" value={pinY} onChange={(event) => setPinY(Number(event.target.value))} /><span>{pinY}%</span></label></div>}
          <label>{isDrawing ? 'Add markup' : 'Add a comment'}<textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={4000} placeholder={isDrawing ? 'Describe the drawing review item…' : 'Share review context, a decision, or a follow-up…'} required /></label><button className="button-primary" disabled={working} type="submit">{isDrawing ? 'Post markup' : 'Post comment'}</button>
        </form>
      </section>
    </main>
  );
}
