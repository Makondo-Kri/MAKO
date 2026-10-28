// Sheets and cards layered over the hall.
import { useEffect, useState } from 'react';
import { ICEBREAKERS, REACTIONS, colorHex } from '../../shared/content.ts';
import type { Invite, PublicParticipant, Spot } from '../../shared/protocol.ts';
import { client } from '../lib/client.ts';
import { Icon, Sheet, ToyBadge, toast, type IconName } from '../components/ui.tsx';
import { ToyPreview } from '../three/ToyPreview.tsx';

const SPOT_COLORS = ['#FF7A5C', '#8C6CF0', '#3FBF8F', '#FFA23A', '#5BB8F5', '#F58BB8'];
const spotName = (spots: Spot[], id?: string) => spots.find((s) => s.id === id)?.name ?? 'a spot';

async function run(p: Promise<{ ok: boolean; error?: string }>, success?: string) {
  const r = await p;
  if (!r.ok) toast(r.error ?? 'Something went wrong', 'error');
  else if (success) toast(success, 'success');
  return r.ok;
}

function BotNote() {
  return (
    <p className="rounded-2xl bg-butter-soft text-ink-soft text-xs px-3 py-2 mb-3">
      <strong className="text-ink">Demo bot</strong> — not a real person. It’s here so you can try waves and games on your own.
    </p>
  );
}

// ---------------- Profile card for another attendee ----------------
export function ProfileSheet({
  participant: p,
  view,
  setView,
  spots,
  invites,
  selfId,
  onClose,
}: {
  participant: PublicParticipant | null;
  view: 'main' | 'meet';
  setView: (v: 'main' | 'meet') => void;
  spots: Spot[];
  invites: Invite[];
  selfId: string;
  onClose: () => void;
}) {
  const [sub, setSub] = useState<'none' | 'say' | 'report'>('none');
  const [waveKey, setWaveKey] = useState(0);
  useEffect(() => setSub('none'), [p?.id]);
  if (!p) return null;

  const pendingWith = (type: Invite['type']) =>
    invites.find((i) => i.type === type && i.status === 'pending' && ((i.from === selfId && i.to === p.id) || (i.to === selfId && i.from === p.id)));
  const gamePending = pendingWith('game');
  const meetPending = pendingWith('meetup');

  const wave = async () => {
    setWaveKey((k) => k + 1);
    client.emote('wave');
    await run(client.wave(p.id), `You waved at ${p.nickname}`);
  };

  return (
    <Sheet open onClose={onClose} label={`${p.nickname}’s profile`}>
      {view === 'meet' ? (
        <div>
          <button className="btn-ghost btn-sm -ml-2 mb-2" onClick={() => setView('main')}>
            <Icon name="arrowLeft" size={18} /> Back
          </button>
          <h2 className="text-xl font-bold mb-1">Meet {p.nickname} in person</h2>
          <p className="text-sm text-ink-mute mb-4">Pick a real spot at the venue. They’ll need to accept before it’s on.</p>
          {p.isBot && <BotNote />}
          <ul className="space-y-2">
            {spots.map((s, i) => (
              <li key={s.id}>
                <button
                  className="w-full card p-3.5 flex items-center gap-3 text-left hover:border-ink/30 active:scale-[.99] transition"
                  onClick={async () => {
                    if (await run(client.inviteMeetup(p.id, s.id), `Invite sent to ${p.nickname}`)) onClose();
                  }}
                >
                  <span className="w-9 h-9 rounded-full grid place-items-center text-white font-bold shrink-0" style={{ background: SPOT_COLORS[i % 6] }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{s.name}</span>
                    {s.hint && <span className="block text-xs text-ink-mute truncate">{s.hint}</span>}
                  </span>
                  <Icon name="pin" size={18} className="text-ink-mute" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-24 h-28 -my-2 -ml-2 shrink-0 rounded-3xl" style={{ background: `color-mix(in srgb, ${colorHex(p.avatar.color)} 18%, #FFFDF9)` }}>
              <ToyPreview avatar={p.avatar} className="w-full h-full" pedestal={false} waveKey={waveKey} zoom={1.3} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold truncate">{p.nickname}</h2>
              <p className="text-sm text-ink-mute">
                {p.status === 'away' ? 'Away right now' : p.busy ? 'Playing a game 🎮' : 'Here in the hall'}
              </p>
            </div>
          </div>
          {p.isBot && <BotNote />}

          <div className="grid grid-cols-3 gap-2 mb-3">
            <Action icon="hand" label="Wave" onClick={wave} />
            <Action
              icon="play"
              label={gamePending ? 'Invited' : 'Play'}
              sub="Sync Up · 40s"
              disabled={!!gamePending || p.busy}
              onClick={async () => {
                if (await run(client.inviteGame(p.id), `Game invite sent to ${p.nickname}`)) onClose();
              }}
            />
            <Action icon="pin" label={meetPending ? 'Invited' : 'Meet up'} sub="In person" disabled={!!meetPending} onClick={() => setView('meet')} accent />
          </div>

          <p className="label mb-2">React</p>
          <div className="flex justify-between mb-4">
            {REACTIONS.map((r) => (
              <button
                key={r}
                className="w-10 h-10 rounded-full text-xl hover:bg-cream active:scale-90 transition-transform"
                aria-label={`Send ${r}`}
                onClick={() => run(client.react(p.id, r), `Sent ${r}`)}
              >
                {r}
              </button>
            ))}
          </div>

          <button className="w-full flex items-center justify-between label mb-2" onClick={() => setSub(sub === 'say' ? 'none' : 'say')} aria-expanded={sub === 'say'}>
            <span>Say something</span>
            <span className="text-ink-faint normal-case tracking-normal font-medium">{sub === 'say' ? 'Hide' : 'Show'}</span>
          </button>
          {sub === 'say' && (
            <div className="flex flex-wrap gap-2 mb-4 animate-rise">
              {ICEBREAKERS.map((m) => (
                <button key={m} className="chip bg-cream hover:bg-cream-deep text-ink text-left h-auto py-2" onClick={() => run(client.say(p.id, m), 'Sent')}>
                  {m}
                </button>
              ))}
            </div>
          )}

          {sub === 'report' ? (
            <div className="rounded-3xl bg-danger-soft p-4 animate-rise">
              <p className="font-semibold mb-1">Report {p.nickname}?</p>
              <p className="text-xs text-ink-soft mb-3">The organizer is notified anonymously and you won’t see each other anymore.</p>
              <div className="flex flex-wrap gap-2">
                {(['inappropriate', 'harassment', 'spam', 'other'] as const).map((r) => (
                  <button
                    key={r}
                    className="chip bg-paper capitalize"
                    onClick={async () => {
                      if (await run(client.report(p.id, r), 'Reported. Thanks for keeping it friendly.')) onClose();
                    }}
                  >
                    {r}
                  </button>
                ))}
                <button className="chip text-ink-mute" onClick={() => setSub('none')}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center gap-4 pt-2 border-t border-line">
              <button
                className="btn-ghost btn-sm text-ink-mute"
                onClick={async () => {
                  if (await run(client.block(p.id), `${p.nickname} is blocked`)) onClose();
                }}
              >
                Block
              </button>
              <button className="btn-ghost btn-sm text-ink-mute" onClick={() => setSub('report')}>
                <Icon name="flag" size={16} /> Report
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Action({ icon, label, sub, onClick, disabled, accent }: { icon: IconName; label: string; sub?: string; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-3xl p-3 flex flex-col items-center gap-1 transition active:scale-95 disabled:opacity-45 ${
        accent ? 'bg-coral text-white shadow-press' : 'bg-ink text-paper shadow-press'
      }`}
    >
      <Icon name={icon} size={24} />
      <span className="text-sm font-bold">{label}</span>
      {sub && <span className="text-[10px] opacity-75 -mt-0.5">{sub}</span>}
    </button>
  );
}

// ---------------- Incoming invite card ----------------
export function IncomingInvite({ invite, from, spots, more, onOpenAll }: { invite: Invite; from?: PublicParticipant; spots: Spot[]; more: number; onOpenAll: () => void }) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, invite.expiresAt - now);
  const pct = (left / (invite.expiresAt - invite.createdAt)) * 100;
  const name = from?.nickname ?? 'Someone';
  const spot = spots.find((s) => s.id === invite.spotId);

  const respond = async (accept: boolean) => {
    setBusy(true);
    await run(client.respond(invite.id, accept));
    setBusy(false);
  };

  return (
    <div className="pointer-events-auto card shadow-float p-4 animate-pop overflow-hidden relative" role="alertdialog" aria-label={`Invitation from ${name}`}>
      <div className="absolute left-0 top-0 h-1 bg-coral transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} aria-hidden="true" />
      <div className="flex items-start gap-3">
        {from && <ToyBadge avatar={from.avatar} size={48} />}
        <div className="flex-1 min-w-0">
          {invite.type === 'game' ? (
            <>
              <p className="font-display font-bold text-lg leading-tight">{name} wants to play Sync Up</p>
              <p className="text-sm text-ink-mute">5 quick this-or-thats. See how in sync you are.</p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-lg leading-tight">Want to meet {name} at the {spot?.name ?? 'meetup spot'}?</p>
              <p className="text-sm text-ink-mute">Let’s say hi in person.{spot?.hint ? ` ${spot.hint}.` : ''}</p>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button className="btn-secondary btn-md flex-1" disabled={busy} onClick={() => respond(false)}>Not now</button>
        <button className="btn-accent btn-md flex-[1.4]" disabled={busy} onClick={() => respond(true)}>
          {invite.type === 'game' ? 'Let’s play' : 'Accept invitation'}
        </button>
      </div>
      {more > 0 && (
        <button className="w-full text-xs text-ink-mute mt-2 underline underline-offset-2" onClick={onOpenAll}>
          +{more} more {more === 1 ? 'invite' : 'invites'}
        </button>
      )}
    </div>
  );
}

// ---------------- Meetup confirmation + "find me" badge ----------------
export function MeetupConfirm({
  invite,
  other,
  me,
  spots,
  onClose,
  onWalk,
}: {
  invite: Invite;
  other?: PublicParticipant;
  me?: PublicParticipant;
  spots: Spot[];
  onClose: () => void;
  onWalk: () => void;
}) {
  const [badge, setBadge] = useState(false);
  const spot = spots.find((s) => s.id === invite.spotId);
  const name = other?.nickname ?? 'them';
  if (badge && me)
    return (
      <button
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6 text-center animate-pop"
        style={{ background: colorHex(me.avatar.color) }}
        onClick={() => setBadge(false)}
        aria-label="Close badge"
      >
        <ToyBadge avatar={me.avatar} size={160} ring />
        <p className="font-display text-4xl font-bold text-ink">Hi, I’m {me.nickname}!</p>
        <p className="text-ink/70 font-medium">Looking for {name} · Tiny Crowd</p>
        <span className="mt-6 text-sm text-ink/60">Tap anywhere to close</span>
      </button>
    );
  return (
    <Sheet open onClose={onClose} label="Meetup confirmed">
      <div className="text-center pt-2">
        <div className="flex justify-center -space-x-3 mb-3">
          {me && <ToyBadge avatar={me.avatar} size={64} ring />}
          {other && <ToyBadge avatar={other.avatar} size={64} ring />}
        </div>
        <p className="label text-mint-deep">It’s a plan</p>
        <h2 className="text-2xl font-bold mt-1">Meet {name} at the {spot?.name ?? 'spot'}</h2>
        {spot?.hint && <p className="text-ink-mute mt-1">{spot.hint}</p>}
        <p className="text-sm text-ink-soft mt-3 bg-cream rounded-2xl p-3">
          Tip: show your “find me” badge so {name} can spot you in the crowd.
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <button className="btn-accent btn-lg" onClick={() => setBadge(true)}>Show my find-me badge</button>
          <button className="btn-secondary btn-md" onClick={onWalk}>Walk my toy there</button>
          <button className="btn-ghost btn-sm" onClick={onClose}>Back to the hall</button>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------- Invites list ----------------
const STATUS: Record<Invite['status'], { label: string; cls: string }> = {
  pending: { label: 'Waiting', cls: 'bg-butter-soft text-ink' },
  accepted: { label: 'Accepted', cls: 'bg-mint-soft text-mint-deep' },
  declined: { label: 'Declined', cls: 'bg-cream-deep text-ink-mute' },
  expired: { label: 'Expired', cls: 'bg-cream-deep text-ink-mute' },
  cancelled: { label: 'Cancelled', cls: 'bg-cream-deep text-ink-mute' },
};

export function InvitesSheet({
  open,
  onClose,
  invites,
  selfId,
  record,
  spots,
}: {
  open: boolean;
  onClose: () => void;
  invites: Invite[];
  selfId: string;
  record: Record<string, PublicParticipant>;
  spots: Spot[];
}) {
  const incoming = invites.filter((i) => i.to === selfId && i.status === 'pending');
  const outgoing = invites.filter((i) => i.from === selfId && i.status === 'pending');
  const meetups = invites.filter((i) => i.type === 'meetup' && i.status === 'accepted');
  const earlier = invites.filter((i) => i.status !== 'pending' && !(i.type === 'meetup' && i.status === 'accepted')).slice(0, 6);

  const row = (i: Invite, actions: React.ReactNode) => {
    const otherId = i.from === selfId ? i.to : i.from;
    const o = record[otherId];
    const what = i.type === 'game' ? 'Sync Up game' : `Meet at ${spotName(spots, i.spotId)}`;
    return (
      <li key={i.id} className="flex items-center gap-3 py-2.5">
        {o ? <ToyBadge avatar={o.avatar} size={40} /> : <span className="w-10 h-10 rounded-full bg-cream" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {i.from === selfId ? `To ${o?.nickname ?? 'someone who left'}` : `From ${o?.nickname ?? 'someone who left'}`}
          </p>
          <p className="text-xs text-ink-mute truncate">{what}{i.note ? ` · ${i.note}` : ''}</p>
        </div>
        {actions}
      </li>
    );
  };
  const pill = (s: Invite['status']) => <span className={`chip h-6 text-xs ${STATUS[s].cls}`}>{STATUS[s].label}</span>;

  return (
    <Sheet open={open} onClose={onClose} label="Invites">
      <h2 className="text-xl font-bold mb-3">Invites</h2>
      {!incoming.length && !outgoing.length && !meetups.length && !earlier.length && (
        <div className="text-center py-8">
          <div className="text-4xl mb-2" aria-hidden="true">💌</div>
          <p className="font-semibold">No invites yet</p>
          <p className="text-sm text-ink-mute">Tap someone’s toy to invite them to play or meet up.</p>
        </div>
      )}
      {!!incoming.length && (
        <section className="mb-3">
          <h3 className="label">For you</h3>
          <ul className="divide-y divide-line">
            {incoming.map((i) =>
              row(
                i,
                <div className="flex gap-1.5">
                  <button className="btn-secondary btn-sm h-8 px-3" onClick={() => run(client.respond(i.id, false))}>Not now</button>
                  <button className="btn-accent btn-sm h-8 px-3" onClick={() => run(client.respond(i.id, true)).then((ok) => ok && i.type === 'game' && onClose())}>Accept</button>
                </div>,
              ),
            )}
          </ul>
        </section>
      )}
      {!!meetups.length && (
        <section className="mb-3">
          <h3 className="label">Meetups</h3>
          <ul className="divide-y divide-line">
            {meetups.map((i) =>
              row(i, <button className="btn-ghost btn-sm h-8 px-3 text-danger" onClick={() => run(client.cancel(i.id), 'Meetup called off')}>Call off</button>),
            )}
          </ul>
        </section>
      )}
      {!!outgoing.length && (
        <section className="mb-3">
          <h3 className="label">Sent</h3>
          <ul className="divide-y divide-line">
            {outgoing.map((i) =>
              row(
                i,
                <div className="flex items-center gap-1.5">
                  {pill('pending')}
                  <button className="btn-ghost btn-sm h-8 px-2.5" onClick={() => run(client.cancel(i.id))}>Cancel</button>
                </div>,
              ),
            )}
          </ul>
        </section>
      )}
      {!!earlier.length && (
        <section>
          <h3 className="label">Earlier</h3>
          <ul className="divide-y divide-line">{earlier.map((i) => row(i, pill(i.status)))}</ul>
        </section>
      )}
    </Sheet>
  );
}

// ---------------- People list (also the keyboard / screen-reader path to everyone) ----------------
export function PeopleSheet({
  open,
  onClose,
  participants,
  me,
  onPick,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  participants: PublicParticipant[];
  me?: PublicParticipant;
  onPick: (id: string) => void;
  onShare: () => void;
}) {
  const sorted = [...participants].sort((a, b) => Number(a.isBot) - Number(b.isBot) || Number(a.status === 'away') - Number(b.status === 'away') || a.nickname.localeCompare(b.nickname));
  return (
    <Sheet open={open} onClose={onClose} label="People here">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Who’s here</h2>
        <button className="btn-secondary btn-sm" onClick={onShare}>Invite people</button>
      </div>
      <ul className="divide-y divide-line">
        {me && (
          <li className="flex items-center gap-3 py-2.5">
            <ToyBadge avatar={me.avatar} size={40} />
            <span className="font-semibold flex-1">{me.nickname} <span className="text-ink-mute font-normal">(you)</span></span>
          </li>
        )}
        {sorted.map((p) => (
          <li key={p.id}>
            <button className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-cream/60 rounded-2xl" onClick={() => onPick(p.id)}>
              <ToyBadge avatar={p.avatar} size={40} />
              <span className="flex-1 min-w-0">
                <span className="font-semibold">{p.nickname}</span>
                {p.isBot && <span className="ml-1.5 chip h-5 px-1.5 text-[10px] bg-butter font-bold uppercase">demo</span>}
                <span className="block text-xs text-ink-mute">{p.status === 'away' ? 'Away' : p.busy ? 'In a game' : 'In the hall'}</span>
              </span>
              <Icon name="hand" size={18} className="text-ink-mute" />
            </button>
          </li>
        ))}
      </ul>
      {!sorted.length && <p className="text-sm text-ink-mute py-6 text-center">Nobody else yet. Share the link to bring people in.</p>}
    </Sheet>
  );
}

// ---------------- Me ----------------
export function MeSheet({ open, onClose, me, eventName, onLeave }: { open: boolean; onClose: () => void; me?: PublicParticipant; eventName: string; onLeave: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [waveKey, setWaveKey] = useState(0);
  useEffect(() => setConfirm(false), [open]);
  if (!me) return null;
  return (
    <Sheet open={open} onClose={onClose} label="My toy">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-24 h-28 -my-2 -ml-2 shrink-0">
          <ToyPreview avatar={me.avatar} className="w-full h-full" pedestal={false} waveKey={waveKey} zoom={1.3} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{me.nickname}</h2>
          <p className="text-sm text-ink-mute">at {eventName}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button className="btn-primary btn-md" onClick={() => { setWaveKey((k) => k + 1); client.emote('wave'); }}>
          👋 Wave to everyone
        </button>
        <button className="btn-secondary btn-md" onClick={() => client.emote('jump')}>
          🦘 Jump
        </button>
      </div>
      <p className="text-xs text-ink-mute mb-4">
        Others only see your nickname and toy. No contact details, no real location. Waves and games aren’t stored after the event.
      </p>
      {confirm ? (
        <div className="rounded-3xl bg-danger-soft p-4">
          <p className="font-semibold mb-1">Leave {eventName}?</p>
          <p className="text-xs text-ink-soft mb-3">Your toy disappears from the hall and pending invites are cancelled.</p>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm flex-1" onClick={() => setConfirm(false)}>Stay</button>
            <button className="btn btn-sm flex-1 bg-danger text-white" onClick={onLeave}>Leave event</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost btn-md w-full text-danger" onClick={() => setConfirm(true)}>
          <Icon name="door" size={18} /> Leave event
        </button>
      )}
    </Sheet>
  );
}

// ---------------- Meetup spots ----------------
export function SpotsSheet({ open, onClose, spots, onGo }: { open: boolean; onClose: () => void; spots: Spot[]; onGo: (index: number) => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Meetup spots">
      <h2 className="text-xl font-bold">Meetup spots</h2>
      <p className="text-sm text-ink-mute mb-3">Real places at this venue. Invite someone from their profile to meet at one.</p>
      <ul className="space-y-2">
        {spots.map((s, i) => (
          <li key={s.id}>
            <button className="w-full card p-3.5 flex items-center gap-3 text-left" onClick={() => onGo(i)}>
              <span className="w-9 h-9 rounded-full grid place-items-center text-white font-bold shrink-0" style={{ background: SPOT_COLORS[i % 6] }}>{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{s.name}</span>
                {s.hint && <span className="block text-xs text-ink-mute">{s.hint}</span>}
              </span>
              <span className="text-xs font-semibold text-ink-mute">Go</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
