import { TaskRecordWorkspace } from '../../../../features/tasks/components/task-record-workspace';

export default async function TaskRecordPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  return <TaskRecordWorkspace projectId={projectId} taskId={taskId} />;
}
