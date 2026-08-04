import { CommunicationRecordWorkspace } from '../../../../features/communications/components/communication-record-workspace';

export default async function CommunicationRecordPage({ params }: { params: Promise<{ projectId: string; communicationId: string }> }) {
  const { projectId, communicationId } = await params;
  return <CommunicationRecordWorkspace projectId={projectId} communicationId={communicationId} />;
}
