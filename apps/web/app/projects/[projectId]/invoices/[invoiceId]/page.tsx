import { InvoiceRecordWorkspace } from '../../../../features/finance/components/invoice-record-workspace';

export default async function InvoiceRecordPage({ params }: { params: Promise<{ projectId: string; invoiceId: string }> }) {
  const { projectId, invoiceId } = await params;
  return <InvoiceRecordWorkspace projectId={projectId} invoiceId={invoiceId} />;
}
