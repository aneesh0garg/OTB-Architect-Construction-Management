'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  loadInvoiceDetail,
  recordProjectPayment,
  restoreLocalLogin,
  transitionProjectInvoice,
  type InvoiceDetail,
} from '../../../local-auth';

export function InvoiceRecordWorkspace({ projectId, invoiceId }: { projectId: string; invoiceId: string }) {
  const [detail, setDetail] = useState<InvoiceDetail>();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<string>();
  const [working, setWorking] = useState(false);
  const refresh = async () => setDetail(await loadInvoiceDetail(projectId, invoiceId));
  useEffect(() => { void (async () => { try { await restoreLocalLogin(); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invoice could not be loaded.'); } })(); }, [projectId, invoiceId]);
  const transition = async (status: string) => { setWorking(true); try { await transitionProjectInvoice(projectId, invoiceId, status); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invoice status could not be updated.'); } finally { setWorking(false); } };
  const pay = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!detail || Number(amount) <= 0) return; setWorking(true); try { const paymentReference = reference.trim(); await recordProjectPayment(projectId, invoiceId, { amount: Number(amount), paidDate: new Date().toISOString().slice(0, 10), ...(paymentReference ? { reference: paymentReference } : {}) }); setAmount(''); setReference(''); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Payment could not be recorded.'); } finally { setWorking(false); } };
  if (!detail) return <main className="record-page"><p className="settings-empty">{message ?? 'Loading invoice…'}</p></main>;
  const invoice = detail.invoice;
  return <main className="record-page" aria-label={`Invoice INV-${invoice.invoice_number}`}>
    <header className="record-page-header"><div><Link href="/" className="back-link">← Back to workspace</Link><p className="eyebrow">PROJECT ACCOUNTING</p><h1>INV-{invoice.invoice_number}</h1><p>{invoice.client_name} · {invoice.issue_date ?? 'Not issued'}</p></div><span className="status-pill current">{invoice.status.replaceAll('_', ' ')}</span></header>
    {message && <p className="form-message">{message}</p>}
    <section className="content-card record-page-card"><div className="record-grid"><div><span>Total</span><strong>₹{Number(invoice.total).toLocaleString('en-IN')}</strong></div><div><span>Received</span><strong>₹{detail.paid.toLocaleString('en-IN')}</strong></div><div><span>Balance</span><strong>₹{detail.balance.toLocaleString('en-IN')}</strong></div><div><span>Accounting</span><strong>{invoice.accounting_sync_status}</strong></div></div><div className="detail-action-row">{invoice.status === 'draft' && <button className="button-secondary" disabled={working} onClick={() => void transition('internal_review')}>Send for review</button>}{invoice.status === 'internal_review' && <button className="button-primary" disabled={working} onClick={() => void transition('issued')}>Issue invoice</button>}</div></section>
    <section className="content-card record-page-card"><div className="card-header"><div><p className="eyebrow">BILLING LINES</p><h2>Invoice basis</h2></div><span>{detail.lines.length} lines</span></div><div className="simple-record-list">{detail.lines.map((line) => <article key={line.id}><strong>{line.description}</strong><span>{line.source_type} · {line.quantity} × ₹{Number(line.unit_amount).toLocaleString('en-IN')}</span><small>₹{Number(line.line_total).toLocaleString('en-IN')}</small></article>)}</div></section>
    <section className="content-card record-page-card"><div className="card-header"><div><p className="eyebrow">COLLECTIONS</p><h2>Payments</h2></div><span>{detail.payments.length} payments</span></div>{['issued', 'partially_paid'].includes(invoice.status) && <form className="inline-form invoice-form" onSubmit={pay}><label>Amount<input min="0.01" max={detail.balance} step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank / receipt reference" /></label><button className="button-primary" disabled={working} type="submit">Record payment</button></form>}<div className="simple-record-list">{detail.payments.length ? detail.payments.map((payment) => <article key={payment.id}><strong>₹{Number(payment.amount).toLocaleString('en-IN')} received</strong><span>{payment.paid_date}</span><small>{payment.reference ?? 'No reference'}</small></article>) : <p>No payments recorded.</p>}</div></section>
  </main>;
}
