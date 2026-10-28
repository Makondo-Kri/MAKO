// Organizer: set up a new event in one short form.
import { useState } from 'react';
import { DEFAULT_SPOTS, MAX_SPOTS } from '../../shared/content.ts';
import { navigate } from '../lib/router.ts';
import { Icon, Spinner, Wordmark } from '../components/ui.tsx';

export const orgKeyStore = {
  get: (id: string) => {
    try {
      return localStorage.getItem(`tinycrowd:org:${id}`);
    } catch {
      return null;
    }
  },
  set: (id: string, key: string) => {
    try {
      localStorage.setItem(`tinycrowd:org:${id}`, key);
    } catch {
      /* ignore */
    }
  },
};

export default function OrganizerCreate() {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [spots, setSpots] = useState(DEFAULT_SPOTS.map((s) => ({ name: s.name, hint: s.hint })));
  const [demoBots, setDemoBots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 3 && spots.every((s) => s.name.trim().length >= 2) && spots.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, venue, spots, demoBots }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Could not create the event');
      orgKeyStore.set(d.event.id, d.organizerKey);
      navigate(`/organize/${d.event.id}?key=${encodeURIComponent(d.organizerKey)}&new=1`);
    } catch (err) {
      setError((err as Error).message === 'Failed to fetch' ? 'Can’t reach the server. Check your connection.' : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#FAF8F5]">
      <header className="border-b border-line bg-paper">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} aria-label="Tiny Crowd home"><Wordmark small /></button>
          <span className="text-sm font-medium text-ink-mute">Organizer</span>
        </div>
      </header>
      <form onSubmit={submit} className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create an event</h1>
          <p className="text-ink-mute">You’ll get a QR code and a live dashboard. Takes about a minute.</p>
        </div>

        <section className="bg-paper border border-line rounded-3xl p-5 space-y-4">
          <div>
            <label htmlFor="ev-name" className="label">Event name</label>
            <input id="ev-name" className="input mt-1.5" placeholder="e.g. Design Week Lisbon" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="ev-venue" className="label">Venue <span className="normal-case tracking-normal font-normal">(optional)</span></label>
            <input id="ev-venue" className="input mt-1.5" placeholder="e.g. LX Factory" value={venue} maxLength={60} onChange={(e) => setVenue(e.target.value)} />
          </div>
        </section>

        <section className="bg-paper border border-line rounded-3xl p-5">
          <h2 className="font-display text-lg font-semibold">Meetup spots</h2>
          <p className="text-sm text-ink-mute mb-4">Real, easy-to-find places at your venue. Attendees invite each other to meet at these.</p>
          <ol className="space-y-3">
            {spots.map((s, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="mt-3.5 w-7 h-7 shrink-0 rounded-full bg-ink text-paper text-sm font-bold grid place-items-center">{i + 1}</span>
                <div className="flex-1 grid sm:grid-cols-2 gap-2">
                  <input
                    className="input h-12 text-base"
                    aria-label={`Spot ${i + 1} name`}
                    placeholder="Name, e.g. Coffee Bar"
                    value={s.name}
                    maxLength={32}
                    onChange={(e) => setSpots(spots.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    className="input h-12 text-base"
                    aria-label={`Spot ${i + 1} hint`}
                    placeholder="Hint, e.g. Next to the stairs"
                    value={s.hint}
                    maxLength={60}
                    onChange={(e) => setSpots(spots.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))}
                  />
                </div>
                <button
                  type="button"
                  className="mt-2 btn-ghost w-10 h-10 shrink-0"
                  aria-label={`Remove spot ${i + 1}`}
                  disabled={spots.length <= 1}
                  onClick={() => setSpots(spots.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ol>
          {spots.length < MAX_SPOTS && (
            <button type="button" className="btn-secondary btn-sm mt-4" onClick={() => setSpots([...spots, { name: '', hint: '' }])}>
              + Add spot
            </button>
          )}
        </section>

        <section className="bg-paper border border-line rounded-3xl p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 accent-ink" checked={demoBots} onChange={(e) => setDemoBots(e.target.checked)} />
            <span>
              <span className="font-semibold block">Add demo bots</span>
              <span className="text-sm text-ink-mute">Three clearly-labelled bots wander the hall so early arrivals can try things out. They never count in your metrics. You can switch them off any time.</span>
            </span>
          </label>
        </section>

        {error && <p className="rounded-2xl bg-danger-soft text-danger px-4 py-3 text-sm font-medium" role="alert">{error}</p>}
        <button className="btn-primary btn-lg w-full sm:w-auto" disabled={!valid || busy}>
          {busy ? <><Spinner className="w-4 h-4" /> Creating…</> : 'Create event'}
        </button>
      </form>
    </main>
  );
}
