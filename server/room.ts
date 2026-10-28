// One live event: who is here, what they are doing, invitations, games, and
// the counters the organizer dashboard reads. Networking lives in index.ts —
// this file only knows about an `Outbox` so it can be tested without sockets.
import { customAlphabet } from 'nanoid';
import {
  AWAY_GRACE_MS,
  BODIES,
  COLORS,
  ACCESSORIES,
  INVITE_TTL_MS,
  SPOT_SLOTS,
  SYNC_COUNTDOWN_MS,
  SYNC_QUESTIONS,
  SYNC_REVEAL_MS,
  SYNC_ROUNDS,
  SYNC_ROUND_MS,
  clampToHall,
  type Avatar,
} from '../shared/content.ts';
import type {
  EventInfo,
  EventStats,
  GameState,
  Interaction,
  Invite,
  JoinResult,
  PublicParticipant,
} from '../shared/protocol.ts';

const makeId = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 10);
const makeToken = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', 32);

export interface Outbox {
  toAll(event: string, data: unknown): void;
  toUser(id: string, event: string, data: unknown): void;
}

export interface Metrics {
  peakOnline: number;
  uniqueJoins: number;
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
  engaged: number;
  spotAccepted: Record<string, number>;
  recentReports: { at: number; reason: string; reportedNickname: string }[];
  timeline: { t: number; online: number }[];
}

export const emptyMetrics = (): Metrics => ({
  peakOnline: 0,
  uniqueJoins: 0,
  waves: 0,
  reactions: 0,
  icebreakers: 0,
  gameInvites: 0,
  gamesStarted: 0,
  gamesCompleted: 0,
  meetupInvites: 0,
  meetupsAccepted: 0,
  meetupsDeclined: 0,
  reports: 0,
  blocks: 0,
  engaged: 0,
  spotAccepted: {},
  recentReports: [],
  timeline: [],
});

class Bucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private capacity: number,
    private perSecond: number,
  ) {
    this.tokens = capacity;
  }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

interface Participant extends PublicParticipant {
  token: string;
  connected: boolean;
  awaySince: number | null;
  blocked: Set<string>;
  engaged: boolean;
  limits: { move: Bucket; social: Bucket; invite: Bucket };
}

interface Game extends GameState {
  answers: Map<string, 0 | 1>;
  order: number[];
  /** False when a demo bot is involved, so it stays out of the organizer metrics. */
  counts: boolean;
}

type Err = { ok: false; error: string };
const err = (error: string): Err => ({ ok: false, error });

export class Room {
  participants = new Map<string, Participant>();
  invites = new Map<string, Invite>();
  games = new Map<string, Game>();
  private lastTimeline = 0;
  private lastBotStep = 0;

  constructor(
    public event: EventInfo,
    public createdAt: number,
    public metrics: Metrics,
    private out: Outbox,
    private onChange: () => void = () => {},
  ) {
    if (event.demoBots) this.spawnBots();
  }

  // ---------------- presence ----------------

  join(data: { nickname: string; avatar: Avatar; resumeToken?: string }): JoinResult {
    let p = data.resumeToken
      ? [...this.participants.values()].find((x) => x.token === data.resumeToken && !x.isBot)
      : undefined;

    if (p) {
      // Same person coming back (refresh or reconnect): keep their spot and invites.
      p.nickname = data.nickname;
      p.avatar = data.avatar;
      p.connected = true;
      p.awaySince = null;
      p.status = 'online';
      this.out.toAll('participant:updated', this.pub(p));
    } else {
      if (this.realCount() >= 500) return { ok: false, error: 'This event is full right now.', code: 'full' };
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 1.8;
      p = {
        id: makeId(),
        token: makeToken(),
        nickname: data.nickname,
        avatar: data.avatar,
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        status: 'online',
        isBot: false,
        busy: false,
        connected: true,
        awaySince: null,
        blocked: new Set(),
        engaged: false,
        limits: {
          move: new Bucket(20, 8),
          social: new Bucket(8, 0.8),
          invite: new Bucket(5, 0.2),
        },
      };
      this.participants.set(p.id, p);
      this.metrics.uniqueJoins++;
      this.out.toAll('participant:joined', this.pub(p));
    }

    this.trackPeak();
    this.onChange();
    const self = p;
    return {
      ok: true,
      self: this.pub(self),
      resumeToken: self.token,
      event: this.event,
      participants: [...this.participants.values()].map((x) => this.pub(x)),
      invites: [...this.invites.values()].filter((i) => i.from === self.id || i.to === self.id),
      blocked: [...self.blocked],
    };
  }

  disconnect(id: string) {
    const p = this.participants.get(id);
    if (!p || p.isBot) return;
    p.connected = false;
    p.awaySince = Date.now();
    p.status = 'away';
    this.out.toAll('participant:updated', this.pub(p));
  }

  leave(id: string) {
    const p = this.participants.get(id);
    if (!p) return;
    this.participants.delete(id);
    for (const inv of this.invites.values()) {
      if (inv.status === 'pending' && (inv.from === id || inv.to === id)) {
        this.setInvite(inv, inv.from === id ? 'cancelled' : 'expired', 'They left the event');
      }
    }
    for (const g of this.games.values()) {
      if (g.players.includes(id) && g.phase !== 'done' && g.phase !== 'abandoned') this.abandonGame(g, id);
    }
    this.out.toAll('participant:left', { id });
    this.onChange();
  }

  move(id: string, x: number, z: number): Err | { ok: true } {
    const p = this.participants.get(id);
    if (!p) return err('Not in the event');
    if (!p.limits.move.take()) return err('Slow down a little');
    const c = clampToHall(x, z);
    p.x = round2(c.x);
    p.z = round2(c.z);
    this.out.toAll('moved', { id, x: p.x, z: p.z });
    return { ok: true };
  }

  emote(id: string, kind: 'wave' | 'jump') {
    const p = this.participants.get(id);
    if (!p || !p.limits.social.take()) return;
    this.out.toAll('emote', { id, kind });
  }

  // ---------------- social ----------------

  private pair(fromId: string, toId: string): Err | { from: Participant; to: Participant } {
    const from = this.participants.get(fromId);
    const to = this.participants.get(toId);
    if (!from) return err('Not in the event');
    if (!to || fromId === toId) return err('That person isn’t here anymore');
    if (from.blocked.has(toId) || to.blocked.has(fromId)) return err('This person isn’t available');
    return { from, to };
  }

  interact(fromId: string, data: { to: string; kind: Interaction['kind']; value?: string }): Err | { ok: true } {
    const pr = this.pair(fromId, data.to);
    if ('ok' in pr) return pr;
    if (!pr.from.limits.social.take()) return err('Easy there — try again in a moment');
    const it: Interaction = { id: makeId(), from: fromId, to: data.to, kind: data.kind, value: data.value, at: Date.now() };
    if (allReal(pr.from, pr.to)) {
      if (data.kind === 'wave') this.metrics.waves++;
      if (data.kind === 'reaction') this.metrics.reactions++;
      if (data.kind === 'icebreaker') this.metrics.icebreakers++;
    }
    this.markEngaged(pr.from, pr.to);
    // Waves and reactions are visible to the room (they animate in the hall).
    // Icebreaker messages go only to the recipient (and back to the sender).
    if (data.kind === 'icebreaker') {
      this.out.toUser(data.to, 'interaction', it);
      this.out.toUser(fromId, 'interaction', it);
    } else {
      this.out.toAll('interaction', it);
    }
    if (pr.to.isBot) this.botRespond(pr.to, pr.from, it);
    this.onChange();
    return { ok: true };
  }

  inviteCreate(fromId: string, data: { to: string; type: 'game' | 'meetup'; spotId?: string }): Err | { ok: true; invite: Invite } {
    const pr = this.pair(fromId, data.to);
    if ('ok' in pr) return pr;
    if (data.type === 'meetup' && !this.event.spots.some((s) => s.id === data.spotId)) return err('Pick a meetup spot');
    const dup = [...this.invites.values()].find(
      (i) =>
        i.status === 'pending' &&
        i.type === data.type &&
        ((i.from === fromId && i.to === data.to) || (i.from === data.to && i.to === fromId)),
    );
    if (dup) return err(dup.from === fromId ? 'You already have an invite waiting with them' : 'They already invited you — check your invites');
    if (data.type === 'game' && (pr.from.busy || pr.to.busy)) return err(pr.from.busy ? 'Finish your current game first' : 'They’re in a game right now');
    if (!pr.from.limits.invite.take()) return err('That’s a lot of invites — give it a few seconds');

    const now = Date.now();
    const inv: Invite = {
      id: makeId(),
      type: data.type,
      from: fromId,
      to: data.to,
      spotId: data.type === 'meetup' ? data.spotId : undefined,
      status: 'pending',
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
    };
    this.invites.set(inv.id, inv);
    if (allReal(pr.from, pr.to)) {
      if (inv.type === 'game') this.metrics.gameInvites++;
      else this.metrics.meetupInvites++;
    }
    this.markEngaged(pr.from, pr.to);
    this.out.toUser(inv.to, 'invite:update', inv);
    this.out.toUser(inv.from, 'invite:update', inv);
    if (pr.to.isBot) this.botInvite(pr.to, inv);
    this.onChange();
    return { ok: true, invite: inv };
  }

  inviteRespond(userId: string, inviteId: string, accept: boolean): Err | { ok: true; invite: Invite } {
    const inv = this.invites.get(inviteId);
    if (!inv || inv.to !== userId) return err('Invite not found');
    if (inv.status !== 'pending') return err(`This invite is already ${inv.status}`);
    if (Date.now() > inv.expiresAt) {
      this.setInvite(inv, 'expired');
      return err('This invite has expired');
    }
    const from = this.participants.get(inv.from);
    if (!from) {
      this.setInvite(inv, 'expired', 'They left the event');
      return err('They left the event');
    }
    const me = this.participants.get(userId)!;
    const counts = allReal(from, me);
    if (!accept) {
      if (inv.type === 'meetup' && counts) this.metrics.meetupsDeclined++;
      this.setInvite(inv, 'declined');
      return { ok: true, invite: inv };
    }
    if (inv.type === 'game') {
      if (from.busy || me.busy) return err('One of you is already in a game');
      const g = this.startGame(inv.from, inv.to);
      inv.gameId = g.id;
    } else if (counts) {
      this.metrics.meetupsAccepted++;
      const s = inv.spotId!;
      this.metrics.spotAccepted[s] = (this.metrics.spotAccepted[s] ?? 0) + 1;
    }
    this.setInvite(inv, 'accepted');
    return { ok: true, invite: inv };
  }

  inviteCancel(userId: string, inviteId: string): Err | { ok: true } {
    const inv = this.invites.get(inviteId);
    if (!inv || (inv.from !== userId && inv.to !== userId)) return err('Invite not found');
    if (inv.status === 'pending' || (inv.type === 'meetup' && inv.status === 'accepted')) {
      this.setInvite(inv, 'cancelled', inv.status === 'accepted' ? 'Meetup called off' : undefined);
    }
    return { ok: true };
  }

  private setInvite(inv: Invite, status: Invite['status'], note?: string) {
    inv.status = status;
    if (note) inv.note = note;
    this.out.toUser(inv.from, 'invite:update', inv);
    this.out.toUser(inv.to, 'invite:update', inv);
    this.onChange();
  }

  block(userId: string, targetId: string): Err | { ok: true } {
    const p = this.participants.get(userId);
    if (!p || userId === targetId) return err('Not possible');
    if (!p.blocked.has(targetId)) {
      p.blocked.add(targetId);
      this.metrics.blocks++;
    }
    for (const inv of this.invites.values()) {
      const between = (inv.from === userId && inv.to === targetId) || (inv.from === targetId && inv.to === userId);
      if (between && inv.status === 'pending') this.setInvite(inv, 'cancelled');
    }
    for (const g of this.games.values()) {
      if (g.players.includes(userId) && g.players.includes(targetId) && g.phase !== 'done' && g.phase !== 'abandoned') {
        this.abandonGame(g, userId);
      }
    }
    this.onChange();
    return { ok: true };
  }

  report(userId: string, targetId: string, reason: string): Err | { ok: true } {
    const target = this.participants.get(targetId);
    if (!this.participants.has(userId) || !target) return err('Not possible');
    this.metrics.reports++;
    this.metrics.recentReports.unshift({ at: Date.now(), reason, reportedNickname: target.nickname });
    this.metrics.recentReports = this.metrics.recentReports.slice(0, 20);
    // Reporting someone also blocks them for you.
    return this.block(userId, targetId);
  }

  // ---------------- mini-game: Sync Up ----------------

  private startGame(a: string, b: string): Game {
    const order = shuffle([...SYNC_QUESTIONS.keys()]).slice(0, SYNC_ROUNDS);
    const g: Game = {
      id: makeId(),
      players: [a, b],
      phase: 'countdown',
      round: 0,
      rounds: SYNC_ROUNDS,
      question: null,
      answered: [],
      history: [],
      deadline: Date.now() + SYNC_COUNTDOWN_MS,
      matches: 0,
      counts: false,
      answers: new Map(),
      order,
    };
    this.games.set(g.id, g);
    g.counts = allReal(...[a, b].map((id) => this.participants.get(id)!));
    if (g.counts) this.metrics.gamesStarted++;
    this.setBusy(g, true);
    this.pushGame(g);
    return g;
  }

  gameAnswer(userId: string, gameId: string, round: number, choice: 0 | 1): Err | { ok: true } {
    const g = this.games.get(gameId);
    if (!g || !g.players.includes(userId)) return err('Game not found');
    if (g.phase !== 'question' || g.round !== round) return err('Too late for that one');
    if (g.answers.has(userId)) return err('Already answered');
    g.answers.set(userId, choice);
    g.answered = [...g.answers.keys()];
    if (g.answers.size === 2) this.revealRound(g);
    else this.pushGame(g);
    return { ok: true };
  }

  gameLeave(userId: string, gameId: string) {
    const g = this.games.get(gameId);
    if (!g || !g.players.includes(userId)) return;
    if (g.phase === 'done' || g.phase === 'abandoned') return;
    this.abandonGame(g, userId);
  }

  private revealRound(g: Game) {
    const [a, b] = g.players;
    const ca = g.answers.get(a) ?? null;
    const cb = g.answers.get(b) ?? null;
    if (ca !== null && ca === cb) g.matches++;
    g.history.push({ q: g.question!, a: [ca, cb] });
    g.phase = 'reveal';
    g.deadline = Date.now() + SYNC_REVEAL_MS;
    this.pushGame(g);
  }

  private nextQuestion(g: Game) {
    g.question = SYNC_QUESTIONS[g.order[g.round]];
    g.answers.clear();
    g.answered = [];
    g.phase = 'question';
    g.deadline = Date.now() + SYNC_ROUND_MS;
    this.pushGame(g);
    for (const id of g.players) {
      const p = this.participants.get(id);
      if (p?.isBot) {
        const round = g.round;
        setTimeout(() => this.gameAnswer(id, g.id, round, Math.random() < 0.5 ? 0 : 1), 1200 + Math.random() * 3000);
      }
    }
  }

  private abandonGame(g: Game, by: string) {
    g.phase = 'abandoned';
    g.abandonedBy = by;
    this.setBusy(g, false);
    this.pushGame(g);
    this.games.delete(g.id);
  }

  private setBusy(g: Game, busy: boolean) {
    for (const id of g.players) {
      const p = this.participants.get(id);
      if (p) {
        p.busy = busy;
        this.out.toAll('participant:updated', this.pub(p));
      }
    }
  }

  private pushGame(g: Game) {
    const { answers: _a, order: _o, counts: _c, ...pub } = g;
    for (const id of g.players) this.out.toUser(id, 'game:state', pub);
  }

  private stepGame(g: Game, now: number) {
    if (now < g.deadline) return;
    if (g.phase === 'countdown') this.nextQuestion(g);
    else if (g.phase === 'question') this.revealRound(g);
    else if (g.phase === 'reveal') {
      g.round++;
      if (g.round >= g.rounds) {
        g.phase = 'done';
        g.question = null;
        if (g.counts) this.metrics.gamesCompleted++;
        this.setBusy(g, false);
        this.pushGame(g);
        this.games.delete(g.id);
        this.onChange();
      } else this.nextQuestion(g);
    }
  }

  // ---------------- housekeeping ----------------

  /** Called a few times per second by the server. */
  tick(now = Date.now()) {
    for (const g of [...this.games.values()]) this.stepGame(g, now);

    for (const inv of this.invites.values()) {
      if (inv.status === 'pending' && now > inv.expiresAt) this.setInvite(inv, 'expired');
    }
    // Forget finished invites after 30 minutes.
    for (const [id, inv] of this.invites) {
      if (inv.status !== 'pending' && now - inv.createdAt > 30 * 60 * 1000) this.invites.delete(id);
    }
    for (const p of [...this.participants.values()]) {
      if (!p.connected && !p.isBot && p.awaySince && now - p.awaySince > AWAY_GRACE_MS) this.leave(p.id);
    }
    if (now - this.lastTimeline > 60_000) {
      this.lastTimeline = now;
      this.metrics.timeline.push({ t: now, online: this.realOnline() });
      if (this.metrics.timeline.length > 24 * 60) this.metrics.timeline.shift();
      this.onChange();
    }
    if (this.event.demoBots && now - this.lastBotStep > 2500) {
      this.lastBotStep = now;
      this.stepBots();
    }
  }

  stats(): EventStats {
    const all = [...this.participants.values()];
    const real = all.filter((p) => !p.isBot);
    return {
      event: this.event,
      createdAt: this.createdAt,
      online: real.filter((p) => p.connected).length,
      away: real.filter((p) => !p.connected).length,
      realOnline: this.realOnline(),
      peakOnline: this.metrics.peakOnline,
      uniqueJoins: this.metrics.uniqueJoins,
      waves: this.metrics.waves,
      reactions: this.metrics.reactions,
      icebreakers: this.metrics.icebreakers,
      gameInvites: this.metrics.gameInvites,
      gamesStarted: this.metrics.gamesStarted,
      gamesCompleted: this.metrics.gamesCompleted,
      meetupInvites: this.metrics.meetupInvites,
      meetupsAccepted: this.metrics.meetupsAccepted,
      meetupsDeclined: this.metrics.meetupsDeclined,
      reports: this.metrics.reports,
      blocks: this.metrics.blocks,
      engagedParticipants: this.metrics.engaged,
      spotPopularity: this.event.spots.map((s) => ({ spotId: s.id, name: s.name, accepted: this.metrics.spotAccepted[s.id] ?? 0 })),
      recentReports: this.metrics.recentReports,
      timeline: this.metrics.timeline,
    };
  }

  setDemoBots(on: boolean) {
    this.event.demoBots = on;
    if (on) this.spawnBots();
    else for (const p of [...this.participants.values()]) if (p.isBot) this.leave(p.id);
    this.onChange();
  }

  private realCount() {
    let n = 0;
    for (const p of this.participants.values()) if (!p.isBot) n++;
    return n;
  }
  private realOnline() {
    let n = 0;
    for (const p of this.participants.values()) if (!p.isBot && p.connected) n++;
    return n;
  }
  private trackPeak() {
    this.metrics.peakOnline = Math.max(this.metrics.peakOnline, this.realOnline());
  }
  private markEngaged(...ps: Participant[]) {
    for (const p of ps) {
      if (!p.engaged && !p.isBot) {
        p.engaged = true;
        this.metrics.engaged++;
      }
    }
  }

  pub(p: Participant): PublicParticipant {
    return { id: p.id, nickname: p.nickname, avatar: p.avatar, x: p.x, z: p.z, status: p.status, isBot: p.isBot, busy: p.busy };
  }

  // ---------------- demo bots (clearly labelled, for solo testing) ----------------

  private spawnBots() {
    const names = ['Pip', 'Mochi', 'Juno'];
    for (const name of names) {
      if ([...this.participants.values()].some((p) => p.isBot && p.nickname === name)) continue;
      const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
      const spot = SPOT_SLOTS[Math.floor(Math.random() * SPOT_SLOTS.length)];
      const bot: Participant = {
        id: 'bot' + makeId(),
        token: makeToken(),
        nickname: name,
        avatar: {
          body: pick(BODIES).id,
          color: pick(COLORS).id,
          accent: pick(COLORS).id,
          accessory: pick(ACCESSORIES).id,
        },
        x: spot.x * 0.6,
        z: spot.z * 0.6,
        status: 'online',
        isBot: true,
        busy: false,
        connected: true,
        awaySince: null,
        blocked: new Set(),
        engaged: false,
        limits: { move: new Bucket(99, 99), social: new Bucket(99, 99), invite: new Bucket(99, 99) },
      };
      this.participants.set(bot.id, bot);
      this.out.toAll('participant:joined', this.pub(bot));
    }
  }

  private stepBots() {
    for (const p of this.participants.values()) {
      if (!p.isBot || p.busy || Math.random() < 0.6) continue;
      const c = clampToHall(p.x + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 6);
      p.x = round2(c.x);
      p.z = round2(c.z);
      this.out.toAll('moved', { id: p.id, x: p.x, z: p.z });
    }
  }

  private botRespond(bot: Participant, to: Participant, it: Interaction) {
    if (it.kind === 'reaction') return;
    setTimeout(() => {
      if (!this.participants.has(bot.id) || !this.participants.has(to.id)) return;
      this.emote(bot.id, 'wave');
      this.interact(bot.id, { to: to.id, kind: 'wave' });
    }, 900);
  }

  private botInvite(bot: Participant, inv: Invite) {
    setTimeout(() => {
      if (this.invites.get(inv.id)?.status !== 'pending') return;
      if (inv.type === 'game') this.inviteRespond(bot.id, inv.id, true);
      else {
        inv.note = 'Demo bots can’t meet in person';
        this.inviteRespond(bot.id, inv.id, false);
      }
    }, 1800);
  }
}

function allReal(...ps: { isBot: boolean }[]) {
  return ps.every((p) => !p.isBot);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
