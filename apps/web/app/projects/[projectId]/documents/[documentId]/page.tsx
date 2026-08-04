import { DocumentRecordWorkspace } from '../../../../features/documents/components/document-record-workspace';

export default async function DocumentRecordPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const { projectId, documentId } = await params;
  return <DocumentRecordWorkspace projectId={projectId} documentId={documentId} />;
}
