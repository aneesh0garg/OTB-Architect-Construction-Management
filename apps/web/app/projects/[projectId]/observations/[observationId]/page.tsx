import { ObservationRecordWorkspace } from '../../../../features/field/components/observation-record-workspace';

export default async function ObservationRecordPage({ params }: { params: Promise<{ projectId: string; observationId: string }> }) {
  const { projectId, observationId } = await params;
  return <ObservationRecordWorkspace projectId={projectId} observationId={observationId} />;
}
