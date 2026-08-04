'use client';

import { useEffect, useState } from 'react';
import { loadMemberProfilePhoto } from '../local-auth';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
const color = (value: string) => {
  const hue = [...value].reduce((total, character) => total + character.charCodeAt(0), 0) % 360;
  return { backgroundColor: `hsl(${hue} 58% 90%)`, color: `hsl(${hue} 46% 30%)` };
};

export function MemberAvatar({ userId, name, className = 'member-avatar' }: { userId: string; name: string; className?: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>();
  useEffect(() => { void loadMemberProfilePhoto(userId).then((result) => setPhotoUrl(result.profilePhotoUrl)).catch(() => setPhotoUrl(null)); }, [userId]);
  const avatarClass = `${className} member-avatar`;
  return photoUrl ? <img className={avatarClass} src={photoUrl} alt={`${name} profile`} /> : <span className={avatarClass} style={color(userId)} aria-label={`${name} initials`}>{initials(name)}</span>;
}
