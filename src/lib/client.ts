// Holds the live event state in the browser and keeps it in sync with the
// server. React components subscribe through `useEvent()`.
import { io, type Socket } from 'socket.io-client';
import { useSyncExternalStore } from 'react';
import type { Avatar } from '../../shared/content.ts';
import type { Ack, EventInfo, GameState, Interaction, Invite, JoinResult, PublicParticipant } from '../../shared/protocol.ts';
import { loadSession, saveSession, clearSession } from './storage.ts';

export type Conn = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'failed';

export interface FeedItem {
  id: string;
  at: number;
  kind: 'wave' | 'reaction' | 'icebreaker' | 'system';
  from?: string;
  text: string;
  value?: string;
}

export interface EventState {
  conn: Conn;
  error: string | null;
  event: EventInfo | null;
  selfId: string | null;
  participants: Record<string, PublicParticipant>;
  invites: Record<string, Invite>;
  blocked: string[];
  game: GameState | null;
  /** Recent things that happened to you (incoming waves, messages). */
  feed: FeedItem[];
  /** Short-lived visual effects in the hall: emoji above a toy, wave animation. */
  effects: { id: string; target: string; emoji?: string; wave?: boolean; at: number }[];
}

const initial = (): EventState => ({
  conn: 'idle',
  error: null,
  event: null,
  selfId: null,
  participants: {},
  invites: {},
  blocked: [],
  game: null,
  feed: [],
  effects: [],
});

class EventClient {
  state: EventState = initial();
  private socket: Socket | null = null;
  private listeners = new Set<() => void>();
  private joinData: { eventId: string; nickname: string; avatar: Avatar } | null = null;
  private seenInteractions = new Set<string>();
  private joining = false;
  private healTimer: ReturnType<typeof setInterval> | undefined;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<EventState> | ((s: EventState) => Partial<EventState>)) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  /** Connect and join. Resolves once the server accepts (or rejects) us. */
  join(eventId: string, nickname: string, avatar: Avatar): Promise<JoinResult> {
    this.joinData = { eventId, nickname, avatar };
    this.set({ conn: 'connecting', error: null });
    if (!this.socket) this.createSocket();
    else if (!this.socket.connected) this.socket.connect();
    return this.sendJoin();
  }

  private createSocket() {
    const s = io({ transports: ['websocket', 'polling'], reconnectionDelay: 800, reconnectionDelayMax: 4000, timeout: 8000 });
    this.socket = s;

    s.on('connect', () => {
      // On reconnect, re-join with our saved token so we keep our toy and invites.
      if (this.state.selfId) this.sendJoin();
    });
    s.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      this.set({ conn: 'reconnecting' });
    });
    s.io.on('reconnect_failed', () => this.set({ conn: 'offline' }));
    s.on('connect_error', () => {
      if (this.state.conn === 'connecting' && !this.state.selfId) {
        this.set({ conn: 'reconnecting' });
      }
    });

    // Self-heal: if we're connected but never got a join reply, ask again.
    this.healTimer = setInterval(() => {
      if (s.connected && this.joinData && this.state.selfId && this.state.conn !== 'connected' && !this.joining) this.sendJoin();
    }, 5000);

    s.on('participant:joined', (p: PublicParticipant) =>
      this.set((st) => ({ participants: { ...st.participants, [p.id]: p } })),
    );
    s.on('participant:updated', (p: PublicParticipant) =>
      this.set((st) => ({ participants: { ...st.participants, [p.id]: { ...st.participants[p.id], ...p } } })),
    );
    s.on('participant:left', ({ id }: { id: string }) =>
      this.set((st) => {
        const next = { ...st.participants };
        delete next[id];
        return { participants: next };
      }),
    );
    s.on('moved', ({ id, x, z }: { id: string; x: number; z: number }) => {
      const p = this.state.participants[id];
      if (!p || id === this.state.selfId) return; // we already moved ourselves locally
      this.set((st) => ({ participants: { ...st.participants, [id]: { ...p, x, z } } }));
    });
    s.on('emote', ({ id, kind }: { id: string; kind: 'wave' | 'jump' }) => this.effect(id, kind === 'wave' ? { wave: true } : {}));
    s.on('interaction', (it: Interaction) => this.onInteraction(it));
    s.on('invite:update', (inv: Invite) => this.set((st) => ({ invites: { ...st.invites, [inv.id]: inv } })));
    s.on('game:state', (g: GameState) => this.set({ game: g }));
  }

  private sendJoin(): Promise<JoinResult> {
    const s = this.socket!;
    const d = this.joinData!;
    const resumeToken = loadSession(d.eventId)?.resumeToken;
    this.joining = true;
    return new Promise((resolve) => {
      s.timeout(10000).emit('join', { ...d, resumeToken }, (errTimeout: Error | null, res: JoinResult) => {
        this.joining = false;
        if (errTimeout) {
          // Drop the queued join so it isn't sent later without us listening.
          s.sendBuffer = [];
          // Not reachable yet — socket.io keeps retrying and we re-join on connect.
          this.set({ conn: this.state.selfId ? 'reconnecting' : 'failed', error: 'Can’t reach the event server.' });
          return resolve({ ok: false, error: 'Can’t reach the event server. Check your connection.' });
        }
        if (!res.ok) {
          this.set({ conn: 'failed', error: res.error });
          return resolve(res);
        }
        saveSession(d.eventId, { resumeToken: res.resumeToken, nickname: d.nickname, avatar: d.avatar });
        const participants: Record<string, PublicParticipant> = {};
        for (const p of res.participants) participants[p.id] = p;
        const invites: Record<string, Invite> = {};
        for (const i of res.invites) invites[i.id] = i;
        this.set({
          conn: 'connected',
          error: null,
          event: res.event,
          selfId: res.self.id,
          participants,
          invites,
          blocked: res.blocked,
        });
        resolve(res);
      });
    });
  }

  private onInteraction(it: Interaction) {
    if (this.seenInteractions.has(it.id)) return;
    this.seenInteractions.add(it.id);
    const me = this.state.selfId;
    if (this.state.blocked.includes(it.from)) return;
    if (it.kind === 'wave') this.effect(it.from, { wave: true });
    if (it.kind === 'reaction') this.effect(it.to, { emoji: it.value });
    if (it.to === me && it.from !== me) {
      const who = this.state.participants[it.from]?.nickname ?? 'Someone';
      const text =
        it.kind === 'wave' ? `${who} waved at you` : it.kind === 'reaction' ? `${who} sent you ${it.value}` : `${who}: “${it.value}”`;
      this.set((st) => ({
        feed: [{ id: it.id, at: it.at, kind: it.kind, from: it.from, text, value: it.value }, ...st.feed].slice(0, 30),
      }));
    }
  }

  effect(target: string, e: { emoji?: string; wave?: boolean }) {
    const id = Math.random().toString(36).slice(2);
    this.set((st) => ({ effects: [...st.effects.slice(-20), { id, target, at: performance.now(), ...e }] }));
    setTimeout(() => this.set((st) => ({ effects: st.effects.filter((x) => x.id !== id) })), 2000);
  }

  private emit<T = Ack>(ev: string, data: unknown): Promise<T> {
    const s = this.socket;
    if (!s?.connected) return Promise.resolve({ ok: false, error: 'You’re offline — reconnecting…' } as T);
    return new Promise((resolve) =>
      s.timeout(8000).emit(ev, data, (e: Error | null, res: T) =>
        resolve(e ? ({ ok: false, error: 'No response — try again' } as T) : res),
      ),
    );
  }

  // ---------- actions ----------
  moveSelf(x: number, z: number) {
    const id = this.state.selfId;
    if (!id) return;
    const p = this.state.participants[id];
    this.set((st) => ({ participants: { ...st.participants, [id]: { ...p, x, z } } }));
    this.socket?.emit('move', { x, z });
  }
  emote(kind: 'wave' | 'jump') {
    return this.emit('emote', { kind });
  }
  wave(to: string) {
    return this.emit('interact', { to, kind: 'wave' });
  }
  react(to: string, value: string) {
    return this.emit('interact', { to, kind: 'reaction', value });
  }
  say(to: string, value: string) {
    return this.emit('interact', { to, kind: 'icebreaker', value });
  }
  inviteGame(to: string) {
    return this.emit('invite:create', { to, type: 'game' });
  }
  inviteMeetup(to: string, spotId: string) {
    return this.emit('invite:create', { to, type: 'meetup', spotId });
  }
  respond(inviteId: string, accept: boolean) {
    return this.emit('invite:respond', { inviteId, accept });
  }
  cancel(inviteId: string) {
    return this.emit('invite:cancel', { inviteId });
  }
  answer(gameId: string, round: number, choice: 0 | 1) {
    return this.emit('game:answer', { gameId, round, choice });
  }
  leaveGame() {
    const g = this.state.game;
    if (g && g.phase !== 'done' && g.phase !== 'abandoned') this.socket?.emit('game:leave', { gameId: g.id });
    this.set({ game: null });
  }
  async block(id: string) {
    const r = await this.emit('block', { id });
    if (r.ok) this.set((st) => ({ blocked: [...st.blocked, id] }));
    return r;
  }
  async report(id: string, reason: string) {
    const r = await this.emit('report', { id, reason });
    if (r.ok) this.set((st) => ({ blocked: [...st.blocked, id] }));
    return r;
  }
  dismissFeed(id: string) {
    this.set((st) => ({ feed: st.feed.filter((f) => f.id !== id) }));
  }
  /** Leave the event for good: removes your toy and forgets this device. */
  async leave() {
    const eventId = this.joinData?.eventId;
    await this.emit('leave', {});
    this.socket?.disconnect();
    this.socket = null;
    clearInterval(this.healTimer);
    if (eventId) clearSession(eventId);
    this.joinData = null;
    this.seenInteractions.clear();
    this.state = initial();
    for (const l of this.listeners) l();
  }
  retry() {
    if (!this.joinData) return;
    this.set({ conn: 'connecting', error: null });
    if (this.socket && !this.socket.connected) this.socket.connect();
    else if (this.socket) this.sendJoin();
  }
}

export const client = new EventClient();
(globalThis as { __tinyCrowd?: EventClient }).__tinyCrowd = client;

export function useEvent<T>(select: (s: EventState) => T): T {
  return useSyncExternalStore(client.subscribe, () => select(client.state));
}
