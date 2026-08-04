'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { beginLocalLogin, loadOrganizationMember, restoreLocalLogin, type OrganizationMemberDetail } from '../local-auth';

export function OrganizationMemberWorkspace({ userId }: { userId: string }) {
  const [member, setMember] = useState<OrganizationMemberDetail>();
  const [message, setMessage] = useState<string>();
  const [signInRequired, setSignInRequired] = useState(false);
  useEffect(() => { void (async () => { try { const viewer = await restoreLocalLogin(); if (!viewer) { setSignInRequired(true); return; } setMember(await loadOrganizationMember(userId)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Organization member could not be loaded.'); } })(); }, [userId]);
  if (signInRequired) return <main className="record-page"><section className="content-card record-page-card auth-required"><p className="eyebrow">ORGANIZATION DIRECTORY</p><h1>Sign in to view this member</h1><button className="button-primary" onClick={() => void beginLocalLogin()}>Sign in</button></section></main>;
  if (!member) return <main className="record-page"><p className="settings-empty">{message ?? 'Loading organization member…'}</p></main>;
  return <main className="record-page" aria-label={`Organization member ${member.display_name}`}><header className="record-page-header"><div><Link href="/" className="back-link">← Back to workspace</Link><p className="eyebrow">ORGANIZATION MEMBER</p><h1>{member.display_name}</h1><p>{member.title ?? 'No job title'} · {member.organization_role ?? 'project member'}</p></div><span className="status-pill current">{member.active ? 'active' : 'inactive'}</span></header><section className="content-card record-page-card"><div className="record-grid"><div><span>Member ID</span><strong>{member.user_id}</strong></div><div><span>Weekly capacity</span><strong>{member.weekly_capacity_hours}h</strong></div><div><span>Organization role</span><strong>{(member.organization_role ?? 'project_member').replaceAll('_', ' ')}</strong></div></div></section><section className="content-card record-page-card"><div className="card-header"><div><p className="eyebrow">PROJECT ASSIGNMENTS</p><h2>Delivery teams</h2></div><span>{member.projects.length}</span></div>{member.projects.length ? <div className="simple-record-list">{member.projects.map((project) => <article key={project.id}><strong>{project.code} · {project.name}</strong><span>{project.role.replaceAll('_', ' ')}</span></article>)}</div> : <p className="settings-empty">This organization member has not been assigned to a project.</p>}</section></main>;
}
