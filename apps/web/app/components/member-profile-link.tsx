import Link from 'next/link';
import { MemberAvatar } from './member-avatar';

type MemberProfileLinkProps = {
  userId: string;
  name: string;
  className?: string;
  stopPropagation?: boolean;
};

/** A consistent, linked member identity for records, comments, and reviews. */
export function MemberProfileLink({ userId, name, className = 'member-name-with-avatar', stopPropagation = false }: MemberProfileLinkProps) {
  return <span className={className}>
    <MemberAvatar userId={userId} name={name} />
    <Link href={`/organization/members/${encodeURIComponent(userId)}`} onClick={(event) => { if (stopPropagation) event.stopPropagation(); }}>{name}</Link>
  </span>;
}
