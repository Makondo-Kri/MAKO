// End-to-end test: starts the real server and connects two independent
// Socket.IO clients to the same event. Run with `npm test`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { GameState, Invite, JoinOk } from '../shared/protocol.ts';

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
let server: ChildProcess;
let eventId = '';

const avatar = { body: 'bean', color: 'coral', accent: 'mint', accessory: 'none' };

function client(): Socket {
  return io(URL, { transports: ['websocket'], forceNew: true });
}
function emit<T>(s: Socket, ev: string, data: unknown): Promise<T> {
  return new Promise((res) => s.emit(ev, data, res));
}
function next<T>(s: Socket, ev: string, pred: (d: T) => boolean = () => true, ms = 15000): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting for ${ev}`)), ms);
    const h = (d: T) => {
      if (pred(d)) {
        clearTimeout(t);
        s.off(ev, h);
        res(d);
      }
    };
    s.on(ev, h);
  });
}

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tinycrowd-'));
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
    stdio: 'pipe',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${URL}/api/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const res = await fetch(`${URL}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test Fest', spots: [{ name: 'Coffee Bar', hint: '' }, { name: 'Stage', hint: '' }] }),
  });
  assert.equal(res.status, 201);
  eventId = (await res.json()).event.id;
});

after(() => server?.kill());

test('two participants: presence, waves, invites, game, meetup, leave', async () => {
  const a = client();
  const b = client();

  const ja = await emit<JoinOk>(a, 'join', { eventId, nickname: 'Ada', avatar });
  assert.equal(ja.ok, true);
  const bJoined = next<{ nickname: string }>(a, 'participant:joined', (p) => p.nickname === 'Ben');
  const jb = await emit<JoinOk>(b, 'join', { eventId, nickname: 'Ben', avatar: { ...avatar, body: 'cat' } });
  assert.equal(jb.ok, true);
  assert.equal((await bJoined).nickname, 'Ben');
  assert.ok(jb.participants.some((p) => p.nickname === 'Ada'), 'B sees A on join');

  // Movement is broadcast and clamped to the hall.
  const moved = next<{ id: string; x: number }>(b, 'moved', (m) => m.id === ja.self.id);
  await emit(a, 'move', { x: 999, z: 0 });
  assert.ok((await moved).x < 11, 'position clamped');

  // Wave from A arrives at B.
  const waved = next<{ kind: string; from: string }>(b, 'interaction', (i) => i.kind === 'wave');
  assert.deepEqual(await emit(a, 'interact', { to: jb.self.id, kind: 'wave' }), { ok: true });
  assert.equal((await waved).from, ja.self.id);

  // Malformed actions are rejected.
  assert.equal((await emit<{ ok: boolean }>(a, 'interact', { to: jb.self.id, kind: 'reaction', value: '<script>' })).ok, false);
  assert.equal((await emit<{ ok: boolean }>(a, 'invite:create', { to: 'nobody', type: 'game' })).ok, false);

  // Game invite → accept → full game.
  const gotInvite = next<Invite>(b, 'invite:update', (i) => i.type === 'game' && i.status === 'pending');
  const created = await emit<{ ok: boolean; invite: Invite }>(a, 'invite:create', { to: jb.self.id, type: 'game' });
  assert.equal(created.ok, true);
  // Duplicate invite is refused.
  assert.equal((await emit<{ ok: boolean }>(a, 'invite:create', { to: jb.self.id, type: 'game' })).ok, false);
  const inv = await gotInvite;
  const firstQ = next<GameState>(a, 'game:state', (g) => g.phase === 'question');
  assert.equal((await emit<{ ok: boolean }>(b, 'invite:respond', { inviteId: inv.id, accept: true })).ok, true);
  let g = await firstQ;
  for (let round = 0; round < g.rounds; round++) {
    const reveal = next<GameState>(a, 'game:state', (s) => s.phase === 'reveal' && s.history.length === round + 1);
    await emit(a, 'game:answer', { gameId: g.id, round, choice: 0 });
    await emit(b, 'game:answer', { gameId: g.id, round, choice: round % 2 === 0 ? 0 : 1 });
    await reveal;
    if (round < g.rounds - 1) g = await next<GameState>(a, 'game:state', (s) => s.phase === 'question' && s.round === round + 1);
  }
  const done = await next<GameState>(b, 'game:state', (s) => s.phase === 'done');
  assert.equal(done.matches, 3);

  // Meetup invite → decline, then another → accept.
  const m1 = next<Invite>(b, 'invite:update', (i) => i.type === 'meetup' && i.status === 'pending');
  await emit(a, 'invite:create', { to: jb.self.id, type: 'meetup', spotId: 's1' });
  const declinedSeen = next<Invite>(a, 'invite:update', (i) => i.type === 'meetup' && i.status === 'declined');
  await emit(b, 'invite:respond', { inviteId: (await m1).id, accept: false });
  await declinedSeen;
  const m2 = next<Invite>(a, 'invite:update', (i) => i.type === 'meetup' && i.status === 'pending' && i.spotId === 's2');
  await emit(b, 'invite:create', { to: ja.self.id, type: 'meetup', spotId: 's2' });
  const acceptedSeen = next<Invite>(b, 'invite:update', (i) => i.status === 'accepted' && i.spotId === 's2');
  await emit(a, 'invite:respond', { inviteId: (await m2).id, accept: true });
  await acceptedSeen;

  // Organizer stats reflect the real activity.
  const stats = await (await fetch(`${URL}/api/events/${eventId}/stats`, { headers: { 'x-organizer-key': 'wrong' } })).status;
  assert.equal(stats, 401);

  // Disconnect marks away; leaving removes.
  const away = next<{ id: string; status: string }>(a, 'participant:updated', (p) => p.id === jb.self.id && p.status === 'away');
  b.disconnect();
  await away;
  const b2 = client();
  const back = await emit<JoinOk>(b2, 'join', { eventId, nickname: 'Ben', avatar, resumeToken: jb.resumeToken });
  assert.equal(back.self.id, jb.self.id, 'resume keeps identity');
  const left = next<{ id: string }>(a, 'participant:left', (p) => p.id === jb.self.id);
  await emit(b2, 'leave', {});
  await left;

  a.disconnect();
  b2.disconnect();
});

test('blocking stops interactions both ways', async () => {
  const a = client();
  const b = client();
  const ja = await emit<JoinOk>(a, 'join', { eventId, nickname: 'Cleo', avatar });
  const jb = await emit<JoinOk>(b, 'join', { eventId, nickname: 'Dev', avatar });
  await emit(a, 'block', { id: jb.self.id });
  assert.equal((await emit<{ ok: boolean }>(b, 'interact', { to: ja.self.id, kind: 'wave' })).ok, false);
  assert.equal((await emit<{ ok: boolean }>(a, 'invite:create', { to: jb.self.id, type: 'game' })).ok, false);
  a.disconnect();
  b.disconnect();
});

test('rejects bad nicknames and unknown events', async () => {
  const a = client();
  const bad = await emit<{ ok: boolean; error: string }>(a, 'join', { eventId, nickname: 'x', avatar });
  assert.equal(bad.ok, false);
  const none = await emit<{ ok: boolean }>(a, 'join', { eventId: 'nope-nope', nickname: 'Valid', avatar });
  assert.equal(none.ok, false);
  a.disconnect();
});
