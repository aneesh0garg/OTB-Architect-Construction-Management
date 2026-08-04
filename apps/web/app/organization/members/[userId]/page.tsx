import { OrganizationMemberWorkspace } from '../../../features/organization-member-workspace';

export default async function OrganizationMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <OrganizationMemberWorkspace userId={userId} />;
}
