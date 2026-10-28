// The messages that travel between browser and server.
// Client → server messages are validated with zod on the server, so a
// tampered or buggy client can't put bad data into the room.
import { z } from 'zod';
import { ACCESSORIES, BODIES, COLORS, ICEBREAKERS, REACTIONS, type Avatar } from './content.ts';

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as unknown as [T[number]['id'], ...T[number]['id'][]];

export const avatarSchema = z.object({
  body: z.enum(ids(BODIES)),
  color: z.enum(ids(COLORS)),
  accent: z.enum(ids(COLORS)),
  accessory: z.enum(ids(ACCESSORIES)),
});

export const nicknameSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(2, 'At least 2 characters')
      .max(18, 'Keep it under 18 characters')
      .regex(/^[\p{L}\p{N} ._'’-]+$/u, 'Letters, numbers and spaces only'),
  );

export const eventIdSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);
const pid = z.string().min(4).max(32);

export const joinSchema = z.object({
  eventId: eventIdSchema,
  nickname: nicknameSchema,
  avatar: avatarSchema,
  resumeToken: z.string().max(64).optional(),
});

export const moveSchema = z.object({ x: z.number().finite(), z: z.number().finite() });

export const emoteSchema = z.object({ kind: z.enum(['wave', 'jump']) });

export const interactSchema = z.discriminatedUnion('kind', [
  z.object({ to: pid, kind: z.literal('wave') }),
  z.object({ to: pid, kind: z.literal('reaction'), value: z.enum(REACTIONS) }),
  z.object({ to: pid, kind: z.literal('icebreaker'), value: z.enum(ICEBREAKERS) }),
]);

export const inviteCreateSchema = z.discriminatedUnion('type', [
  z.object({ to: pid, type: z.literal('game') }),
  z.object({ to: pid, type: z.literal('meetup'), spotId: z.string().max(8) }),
]);

export const inviteRespondSchema = z.object({ inviteId: z.string().max(32), accept: z.boolean() });
export const inviteCancelSchema = z.object({ inviteId: z.string().max(32) });
export const gameAnswerSchema = z.object({
  gameId: z.string().max(32),
  round: z.number().int().min(0).max(20),
  choice: z.union([z.literal(0), z.literal(1)]),
});
export const gameLeaveSchema = z.object({ gameId: z.string().max(32) });
export const blockSchema = z.object({ id: pid });
export const reportSchema = z.object({
  id: pid,
  reason: z.enum(['inappropriate', 'harassment', 'spam', 'other']),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(3).max(60),
  venue: z.string().trim().max(60).optional().default(''),
  spots: z
    .array(z.object({ name: z.string().trim().min(2).max(32), hint: z.string().trim().max(60).default('') }))
    .min(1)
    .max(6),
  demoBots: z.boolean().optional().default(false),
});

// ---------- Shapes the server sends ----------

export interface Spot {
  id: string;
  name: string;
  hint: string;
}

export interface EventInfo {
  id: string;
  name: string;
  venue: string;
  spots: Spot[];
  demoBots: boolean;
}

export interface PublicParticipant {
  id: string;
  nickname: string;
  avatar: Avatar;
  x: number;
  z: number;
  status: 'online' | 'away';
  /** Demo bots are not real people and are always labelled in the UI. */
  isBot: boolean;
  /** True while this participant is playing a mini-game. */
  busy: boolean;
}

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface Invite {
  id: string;
  type: 'game' | 'meetup';
  from: string;
  to: string;
  spotId?: string;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  /** Set when a game invite is accepted and a game starts. */
  gameId?: string;
  note?: string;
}

export interface Interaction {
  id: string;
  from: string;
  to: string;
  kind: 'wave' | 'reaction' | 'icebreaker';
  value?: string;
  at: number;
}

export interface GameState {
  id: string;
  players: [string, string];
  phase: 'countdown' | 'question' | 'reveal' | 'done' | 'abandoned';
  round: number;
  rounds: number;
  question: [string, string, string] | null;
  /** Who has answered the current round. Values are hidden until reveal. */
  answered: string[];
  /** Revealed answers per finished round: [playerA choice, playerB choice]. */
  history: { q: [string, string, string]; a: [number | null, number | null] }[];
  deadline: number;
  matches: number;
  abandonedBy?: string;
}

export interface JoinOk {
  ok: true;
  self: PublicParticipant;
  resumeToken: string;
  event: EventInfo;
  participants: PublicParticipant[];
  invites: Invite[];
  blocked: string[];
}
export type JoinResult = JoinOk | { ok: false; error: string; code?: string };

export type Ack = { ok: true; invite?: Invite } | { ok: false; error: string };

export interface EventStats {
  event: EventInfo;
  createdAt: number;
  online: number;
  away: number;
  peakOnline: number;
  uniqueJoins: number;
  realOnline: number;
  waves: number;
  reactions: number;
  icebreakers: number;
  gameInvites: number;
  gamesStarted: number;
  gamesCompleted: number;
  meetupInvites: number;
  meetupsAccepted: number;
  meetupsDeclined: number;
  reports: number;
  blocks: number;
  /** People who sent or received at least one interaction. */
  engagedParticipants: number;
  spotPopularity: { spotId: string; name: string; accepted: number }[];
  recentReports: { at: number; reason: string; reportedNickname: string }[];
  timeline: { t: number; online: number }[];
}
