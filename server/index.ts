// Tiny Crowd server: one Node process that
//  • serves the built web app (in production),
//  • exposes a small REST API for organizers,
//  • runs the realtime event rooms over Socket.IO.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { customAlphabet } from 'nanoid';
import { DEFAULT_SPOTS } from '../shared/content.ts';
import {
  blockSchema,
  createEventSchema,
  emoteSchema,
  eventIdSchema,
  gameAnswerSchema,
  gameLeaveSchema,
  interactSchema,
  inviteCancelSchema,
  inviteCreateSchema,
  inviteRespondSchema,
  joinSchema,
  moveSchema,
  reportSchema,
  type EventInfo,
} from '../shared/protocol.ts';
import { Room, emptyMetrics } from './room.ts';
import { Store, hashKey, type StoredEvent } from './store.ts';

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = resolve(process.env.DATA_DIR ?? './data');
const PUBLIC_URL = process.env.PUBLIC_URL ?? '';
const ALLOW_CREATE = process.env.ALLOW_EVENT_CREATION !== 'false';
const DEMO_KEY = process.env.DEMO_ORGANIZER_KEY ?? 'demo';
const isProd = process.env.NODE_ENV === 'production';

const store = new Store(DATA_DIR);
const app = express();
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 16_000, pingInterval: 10_000, pingTimeout: 8_000 });

// ---------------- rooms ----------------

interface Live {
  room: Room;
  stored: StoredEvent;
  saveTimer: NodeJS.Timeout | null;
}
const live = new Map<string, Live>();

function attach(stored: StoredEvent): Live {
  const id = stored.event.id;
  const entry: Live = { stored, saveTimer: null, room: null as unknown as Room };
  const scheduleSave = () => {
    if (entry.saveTimer) return;
    entry.saveTimer = setTimeout(() => {
      entry.saveTimer = null;
      store.save(entry.stored);
    }, 2000);
  };
  entry.room = new Room(
    stored.event,
    stored.createdAt,
    stored.metrics,
    {
      toAll: (ev, data) => io.to(`e:${id}`).emit(ev, data),
      toUser: (pid, ev, data) => io.to(`u:${id}:${pid}`).emit(ev, data),
    },
    scheduleSave,
  );
  live.set(id, entry);
  return entry;
}

for (const s of store.loadAll()) attach(s);

const existingDemo = live.get('demo');
if (existingDemo) {
  // Keep the demo key in sync with the environment variable.
  existingDemo.stored.organizerKeyHash = hashKey(DEMO_KEY);
} else {
  const demo: StoredEvent = {
    event: { id: 'demo', name: 'Tiny Crowd Demo Night', venue: 'Anywhere', spots: DEFAULT_SPOTS, demoBots: true },
    createdAt: Date.now(),
    organizerKeyHash: hashKey(DEMO_KEY),
    metrics: emptyMetrics(),
  };
  store.save(demo);
  attach(demo);
}

setInterval(() => {
  const now = Date.now();
  for (const l of live.values()) l.room.tick(now);
}, 200);

// ---------------- REST API ----------------

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, events: live.size });
});

app.get('/api/config', (_req, res) => {
  res.json({ publicUrl: PUBLIC_URL, allowCreate: ALLOW_CREATE });
});

app.get('/api/events/:id', (req, res) => {
  const l = live.get(req.params.id);
  if (!l) return void res.status(404).json({ error: 'Event not found' });
  const s = l.room.stats();
  res.json({ event: l.room.event, online: s.online });
});

const createLimiter = new Map<string, number[]>();
const makeSuffix = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 4);

app.post('/api/events', (req, res) => {
  if (!ALLOW_CREATE) return void res.status(403).json({ error: 'Event creation is turned off on this server' });
  const ip = req.ip ?? 'x';
  const recent = (createLimiter.get(ip) ?? []).filter((t) => Date.now() - t < 60 * 60 * 1000);
  if (recent.length >= 10) return void res.status(429).json({ error: 'Too many events created. Try again later.' });
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid event' });
  recent.push(Date.now());
  createLimiter.set(ip, recent);

  const base =
    parsed.data.name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28) || 'event';
  let id = `${base}-${makeSuffix()}`;
  while (live.has(id)) id = `${base}-${makeSuffix()}`;

  const organizerKey = randomBytes(18).toString('base64url');
  const event: EventInfo = {
    id,
    name: parsed.data.name,
    venue: parsed.data.venue,
    spots: parsed.data.spots.map((s, i) => ({ id: `s${i + 1}`, name: s.name, hint: s.hint })),
    demoBots: parsed.data.demoBots,
  };
  const stored: StoredEvent = { event, createdAt: Date.now(), organizerKeyHash: hashKey(organizerKey), metrics: emptyMetrics() };
  store.save(stored);
  attach(stored);
  res.status(201).json({ event, organizerKey });
});

function organizer(req: express.Request, res: express.Response): Live | null {
  const l = live.get(String(req.params.id));
  const key = String(req.header('x-organizer-key') ?? '');
  if (!l) {
    res.status(404).json({ error: 'Event not found' });
    return null;
  }
  if (!key || hashKey(key) !== l.stored.organizerKeyHash) {
    res.status(401).json({ error: 'Wrong organizer key' });
    return null;
  }
  return l;
}

app.get('/api/events/:id/stats', (req, res) => {
  const l = organizer(req, res);
  if (l) res.json(l.room.stats());
});

app.patch('/api/events/:id', (req, res) => {
  const l = organizer(req, res);
  if (!l) return;
  if (typeof req.body?.demoBots === 'boolean') l.room.setDemoBots(req.body.demoBots);
  res.json({ event: l.room.event });
});

// ---------------- realtime ----------------

// How many open tabs/sockets each participant has, so a second tab closing
// doesn't mark someone as away.
const sockets = new Map<string, Set<string>>();

io.on('connection', (socket: Socket) => {
  let eventId: string | null = null;
  let pid: string | null = null;

  const room = () => (eventId ? live.get(eventId)?.room : undefined);

  // Helper: validate the payload, run the handler, reply via ack if given.
  function on<T>(name: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, fn: (r: Room, me: string, data: T) => unknown) {
    socket.on(name, (raw: unknown, ack?: unknown) => {
      const reply = typeof ack === 'function' ? (ack as (v: unknown) => void) : () => {};
      const r = room();
      if (!r || !pid) return reply({ ok: false, error: 'Not connected to an event' });
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'Invalid request' });
      try {
        reply(fn(r, pid, parsed.data) ?? { ok: true });
      } catch (e) {
        console.error(`[socket] ${name} failed`, e);
        reply({ ok: false, error: 'Something went wrong' });
      }
    });
  }

  socket.on('join', (raw: unknown, ack?: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (v: unknown) => void) : () => {};
    const parsed = joinSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return reply({ ok: false, error: issue?.path[0] === 'nickname' ? `Nickname: ${issue.message}` : 'Invalid join request' });
    }
    if (!eventIdSchema.safeParse(parsed.data.eventId).success) return reply({ ok: false, error: 'Unknown event' });
    const l = live.get(parsed.data.eventId);
    if (!l) return reply({ ok: false, error: 'This event doesn’t exist (yet). Check the link or QR code.', code: 'not_found' });

    // A repeated join on the same socket (e.g. the client's reply timed out)
    // is only allowed as a resume of the same participant.
    if (pid && (eventId !== l.stored.event.id || !parsed.data.resumeToken)) return reply({ ok: false, error: 'Already joined' });
    const result = l.room.join(parsed.data);
    if (!result.ok) return reply(result);
    if (pid && pid !== result.self.id) {
      socket.leave(`u:${eventId}:${pid}`);
      sockets.get(`${eventId}:${pid}`)?.delete(socket.id);
    }
    eventId = l.stored.event.id;
    pid = result.self.id;
    socket.join(`e:${eventId}`);
    socket.join(`u:${eventId}:${pid}`);
    const key = `${eventId}:${pid}`;
    if (!sockets.has(key)) sockets.set(key, new Set());
    sockets.get(key)!.add(socket.id);
    reply(result);
  });

  on('move', moveSchema, (r, me, d) => r.move(me, d.x, d.z));
  on('emote', emoteSchema, (r, me, d) => r.emote(me, d.kind));
  on('interact', interactSchema, (r, me, d) => r.interact(me, d));
  on('invite:create', inviteCreateSchema, (r, me, d) => r.inviteCreate(me, d));
  on('invite:respond', inviteRespondSchema, (r, me, d) => r.inviteRespond(me, d.inviteId, d.accept));
  on('invite:cancel', inviteCancelSchema, (r, me, d) => r.inviteCancel(me, d.inviteId));
  on('game:answer', gameAnswerSchema, (r, me, d) => r.gameAnswer(me, d.gameId, d.round, d.choice));
  on('game:leave', gameLeaveSchema, (r, me, d) => r.gameLeave(me, d.gameId));
  on('block', blockSchema, (r, me, d) => r.block(me, d.id));
  on('report', reportSchema, (r, me, d) => r.report(me, d.id, d.reason));

  socket.on('leave', (_raw: unknown, ack?: unknown) => {
    const r = room();
    if (r && pid) r.leave(pid);
    if (eventId && pid) sockets.delete(`${eventId}:${pid}`);
    pid = null;
    if (typeof ack === 'function') ack({ ok: true });
    socket.disconnect(true);
  });

  socket.on('disconnect', () => {
    if (!eventId || !pid) return;
    const key = `${eventId}:${pid}`;
    const set = sockets.get(key);
    set?.delete(socket.id);
    if (!set || set.size === 0) {
      sockets.delete(key);
      room()?.disconnect(pid);
    }
  });
});

// ---------------- web app ----------------

const dist = resolve('dist');
if (isProd && existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
} else if (isProd) {
  console.warn('[server] dist/ not found — run `npm run build` first');
}

http.listen(PORT, () => {
  console.log(`[server] Tiny Crowd listening on http://localhost:${PORT}${isProd ? '' : ' (API + realtime; web app on :5173)'}`);
  console.log(`[server] ${live.size} event(s) loaded from ${DATA_DIR}`);
});
