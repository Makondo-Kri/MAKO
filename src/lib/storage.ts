// Small, failure-tolerant wrappers around localStorage (private browsing can throw).
import type { Avatar } from '../../shared/content.ts';

export interface Session {
  resumeToken: string;
  nickname: string;
  avatar: Avatar;
}

const key = (eventId: string) => `tinycrowd:session:${eventId}`;
const PROFILE = 'tinycrowd:profile';

function read<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable — the app still works, it just won't remember you */
  }
}

export const loadSession = (eventId: string) => read<Session>(key(eventId));
export function saveSession(eventId: string, s: Session) {
  write(key(eventId), s);
  write(PROFILE, { nickname: s.nickname, avatar: s.avatar });
}
export function clearSession(eventId: string) {
  try {
    localStorage.removeItem(key(eventId));
  } catch {
    /* ignore */
  }
}
export const loadProfile = () => read<{ nickname: string; avatar: Avatar }>(PROFILE);
