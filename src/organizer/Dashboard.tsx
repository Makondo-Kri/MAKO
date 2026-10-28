// Organizer dashboard: share link + QR, and live metrics computed from real activity.
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { EventStats } from '../../shared/protocol.ts';
import { navigate } from '../lib/router.ts';
import { Icon, Spinner, Wordmark, toast } from '../components/ui.tsx';
import { orgKeyStore } from './OrganizerCreate.tsx';

export default function Dashboard({ eventId }: { eventId: string }) {
  const params = new URLSearchParams(location.search);
  const [key, setKey] = useState(() => params.get('key') ?? orgKeyStore.get(eventId) ?? '');
  const [keyInput, setKeyInput] = useState('');
  const [stats, setStats] = useState<EventStats | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'unauthorized' | 'notfound' | 'error'>(key ? 'loading' : 'unauthorized');
  const [publicUrl, setPublicUrl] = useState('');
  const [qr, setQr] = useState('');
  const isNew = params.get('new') === '1';

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => setPublicUrl(c.publicUrl || location.origin))
      .catch(() => setPublicUrl(location.origin));
  }, []);

  const link = publicUrl ? `${publicUrl.replace(/\/$/, '')}/e/${eventId}` : '';
  useEffect(() => {
    if (link) QRCode.toDataURL(link, { width: 640, margin: 2, color: { dark: '#1E1B2E', light: '#FFFFFF' } }).then(setQr);
  }, [link]);

  useEffect(() => {
    if (!key) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/events/${eventId}/stats`, { headers: { 'x-organizer-key': key } });
        if (stop) return;
        if (r.status === 401) return setState('unauthorized');
        if (r.status === 404) return setState('notfound');
        if (!r.ok) throw new Error();
        setStats(await r.json());
        setState('ok');
        orgKeyStore.set(eventId, key);
      } catch {
        if (!stop) setState((s) => (s === 'ok' ? 'ok' : 'error'));
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [eventId, key]);

  async function toggleBots(on: boolean) {
    const r = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-organizer-key': key },
      body: JSON.stringify({ demoBots: on }),
    });
    if (r.ok) {
      const d = await r.json();
      setStats((s) => (s ? { ...s, event: d.event } : s));
      toast(on ? 'Demo bots on' : 'Demo bots off', 'success');
    } else toast('Could not update', 'error');
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, 'success');
    } catch {
      toast('Copy failed — select and copy manually', 'error');
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-[#FAF8F5]">
      <header className="border-b border-line bg-paper sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <button onClick={() => navigate('/')} aria-label="Tiny Crowd home"><Wordmark small /></button>
          <span className="text-sm font-medium text-ink-mute">Organizer dashboard</span>
        </div>
      </header>
      {children}
    </main>
  );

  if (state === 'unauthorized')
    return shell(
      <form
        className="max-w-sm mx-auto px-5 py-16"
        onSubmit={(e) => {
          e.preventDefault();
          setState('loading');
          setKey(keyInput.trim());
        }}
      >
        <h1 className="text-2xl font-bold mb-1">Organizer key needed</h1>
        <p className="text-ink-mute mb-5">Use the private dashboard link you got when you created <strong>{eventId}</strong>.{eventId === 'demo' ? ' For the demo event the key is “demo”.' : ''}</p>
        {key && <p className="text-sm text-danger mb-3" role="alert">That key didn’t work.</p>}
        <label htmlFor="okey" className="label">Organizer key</label>
        <input id="okey" className="input mt-1.5 mb-3" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoComplete="off" />
        <button className="btn-primary btn-lg w-full" disabled={!keyInput.trim()}>Open dashboard</button>
      </form>,
    );
  if (state === 'notfound') return shell(<p className="text-center py-20 text-ink-mute">This event doesn’t exist.</p>);
  if (state === 'error' && !stats)
    return shell(
      <div className="text-center py-20">
        <p className="text-ink-mute mb-4">Can’t reach the server.</p>
        <button className="btn-primary btn-md" onClick={() => location.reload()}>Retry</button>
      </div>,
    );
  if (!stats) return shell(<div className="grid place-items-center py-24"><Spinner /></div>);

  const s = stats;
  const engagedPct = s.uniqueJoins ? Math.round((s.engagedParticipants / s.uniqueJoins) * 100) : 0;
  const dashLink = `${location.origin}/organize/${eventId}?key=${encodeURIComponent(key)}`;

  return shell(
    <div className="max-w-6xl mx-auto px-5 py-6 space-y-5">
      {isNew && (
        <div className="rounded-3xl bg-butter-soft border border-butter p-4 text-sm">
          <p className="font-semibold mb-1">Your event is live. Bookmark this page.</p>
          <p className="text-ink-soft mb-2">This private link is the only way back to your dashboard — it contains your organizer key. Don’t share it with attendees.</p>
          <button className="btn-secondary btn-sm" onClick={() => copy(dashLink, 'Dashboard link')}><Icon name="copy" size={16} /> Copy dashboard link</button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Event</p>
          <h1 className="text-3xl font-bold">{s.event.name}</h1>
          {s.event.venue && <p className="text-ink-mute">{s.event.venue}</p>}
        </div>
        <span className="chip bg-mint-soft text-mint-deep font-semibold">
          <span className="w-2 h-2 rounded-full bg-mint animate-pulse" aria-hidden="true" /> Live · updates every 3s
        </span>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Share */}
        <section className="bg-paper border border-line rounded-3xl p-5 h-fit">
          <h2 className="font-display font-semibold text-lg mb-3">Attendee access</h2>
          {qr ? <img src={qr} alt={`QR code linking to ${link}`} className="w-full max-w-[260px] mx-auto rounded-2xl border border-line" /> : <div className="aspect-square grid place-items-center"><Spinner /></div>}
          <p className="text-xs text-ink-mute mt-3 mb-1">Event link</p>
          <p className="text-sm font-mono bg-cream rounded-xl px-3 py-2 break-all">{link}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="btn-secondary btn-sm" onClick={() => copy(link, 'Link')}><Icon name="copy" size={16} /> Copy</button>
            <a className="btn-secondary btn-sm" href={qr} download={`tiny-crowd-${eventId}-qr.png`}><Icon name="download" size={16} /> QR</a>
          </div>
          <a className="btn-ghost btn-sm w-full mt-2" href={`/e/${eventId}`} target="_blank" rel="noreferrer">Open attendee view ↗</a>
          <hr className="my-4 border-line" />
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 accent-ink" checked={s.event.demoBots} onChange={(e) => toggleBots(e.target.checked)} />
            <span className="text-sm">
              <span className="font-semibold block">Demo bots</span>
              <span className="text-ink-mute">Labelled bots for testing. Never counted below.</span>
            </span>
          </label>
        </section>

        <div className="space-y-5">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="In the hall now" value={s.online} sub={s.away ? `${s.away} reconnecting` : 'real people'} strong />
            <Stat label="Peak at once" value={s.peakOnline} />
            <Stat label="Total joined" value={s.uniqueJoins} />
            <Stat label="Engaged" value={`${engagedPct}%`} sub={`${s.engagedParticipants} interacted with someone`} />
          </section>

          <section className="bg-paper border border-line rounded-3xl p-5">
            <h2 className="font-display font-semibold text-lg mb-3">Attendance over time</h2>
            <Timeline points={s.timeline} />
          </section>

          <section className="grid md:grid-cols-3 gap-3">
            <Block title="Interactions">
              <Row k="Waves" v={s.waves} />
              <Row k="Reactions" v={s.reactions} />
              <Row k="Icebreaker messages" v={s.icebreakers} />
            </Block>
            <Block title="Sync Up games">
              <Row k="Invites sent" v={s.gameInvites} />
              <Row k="Games started" v={s.gamesStarted} />
              <Row k="Games finished" v={s.gamesCompleted} />
            </Block>
            <Block title="Meetups (in person)">
              <Row k="Invites sent" v={s.meetupInvites} />
              <Row k="Accepted" v={s.meetupsAccepted} strong />
              <Row k="Declined" v={s.meetupsDeclined} />
            </Block>
          </section>

          <section className="grid md:grid-cols-2 gap-3">
            <Block title="Popular meetup spots">
              <SpotBars spots={s.spotPopularity} />
            </Block>
            <Block title="Safety">
              <Row k="Reports" v={s.reports} />
              <Row k="Blocks" v={s.blocks} />
              {s.recentReports.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {s.recentReports.slice(0, 5).map((r, i) => (
                    <li key={i} className="text-sm flex justify-between gap-2 bg-danger-soft/60 rounded-xl px-3 py-1.5">
                      <span><strong>{r.reportedNickname}</strong> · {r.reason}</span>
                      <span className="text-ink-mute">{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-mute mt-2">No reports. 🎉</p>
              )}
            </Block>
          </section>
          <p className="text-xs text-ink-mute">
            All numbers come from real attendee activity on this server. Demo bots and anything involving them are excluded. Messages and game answers are not stored.
          </p>
        </div>
      </div>
    </div>,
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: number | string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-3xl p-4 border ${strong ? 'bg-ink text-paper border-ink' : 'bg-paper border-line'}`}>
      <p className={`text-xs font-semibold ${strong ? 'text-paper/70' : 'text-ink-mute'}`}>{label}</p>
      <p className="font-display text-3xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${strong ? 'text-paper/70' : 'text-ink-mute'}`}>{sub}</p>}
    </div>
  );
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper border border-line rounded-3xl p-5">
      <h3 className="font-display font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
function Row({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-line/60 last:border-0">
      <span className="text-ink-soft">{k}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-coral-deep' : 'font-semibold'}`}>{v}</span>
    </div>
  );
}
function SpotBars({ spots }: { spots: EventStats['spotPopularity'] }) {
  const max = Math.max(1, ...spots.map((s) => s.accepted));
  return (
    <ul className="space-y-2">
      {spots.map((s) => (
        <li key={s.spotId}>
          <div className="flex justify-between text-sm mb-1">
            <span>{s.name}</span>
            <span className="font-semibold tabular-nums">{s.accepted}</span>
          </div>
          <div className="h-2 rounded-full bg-cream-deep overflow-hidden">
            <div className="h-full bg-coral rounded-full" style={{ width: `${(s.accepted / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
function Timeline({ points }: { points: { t: number; online: number }[] }) {
  const data = useMemo(() => points.slice(-180), [points]);
  if (data.length < 2) return <p className="text-sm text-ink-mute py-6 text-center">The chart fills in as the event runs (one point per minute).</p>;
  const W = 600;
  const H = 120;
  const max = Math.max(1, ...data.map((d) => d.online));
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 10) - 2;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.online).toFixed(1)}`).join('');
  const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none" role="img" aria-label={`People online, peak ${max}`}>
        <path d={`${line}L${W},${H}L0,${H}Z`} fill="#FFE3DA" />
        <path d={line} fill="none" stroke="#FF6B4A" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex justify-between text-xs text-ink-mute mt-1">
        <span>{fmt(data[0].t)}</span>
        <span>max {max} online</span>
        <span>{fmt(data[data.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}
