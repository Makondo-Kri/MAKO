// The root page: what Tiny Crowd is, a way into the demo, and a way to host.
import { useState } from 'react';
import { navigate } from '../lib/router.ts';
import { Icon, Wordmark } from '../components/ui.tsx';
import { ToyTrio } from '../three/ToyPreview.tsx';

export function Landing() {
  const [code, setCode] = useState('');
  const slug = code.trim().toLowerCase().replace(/^.*\/e\//, '').replace(/[^a-z0-9-]/g, '');
  return (
    <main className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] max-w-5xl w-full mx-auto">
        <Wordmark />
        <button className="btn-ghost btn-sm" onClick={() => navigate('/organize')}>For organizers</button>
      </header>

      <section className="flex-1 w-full max-w-5xl mx-auto px-5 grid md:grid-cols-2 gap-6 md:gap-10 items-center py-6">
        <div className="order-2 md:order-1 animate-rise">
          <p className="label mb-3">The icebreaker game for real-world events</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">The game is the excuse.<br />Meeting people is the reward.</h1>
          <p className="text-ink-soft text-lg mb-7 max-w-md">
            Attendees scan a QR code, make a tiny toy version of themselves, and drop into a shared hall to wave, play and arrange to meet in person.
            No app, no account.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button className="btn-primary btn-lg" onClick={() => navigate('/e/demo')}>
              Try the demo event
            </button>
            <button className="btn-secondary btn-lg" onClick={() => navigate('/organize')}>
              Host an event
            </button>
          </div>
          <form
            className="flex gap-2 max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (slug.length >= 3) navigate(`/e/${slug}`);
            }}
          >
            <label htmlFor="code" className="sr-only">Event code or link</label>
            <input
              id="code"
              className="input h-12 text-base"
              placeholder="Have an event code?"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button className="btn-secondary btn-md h-12 shrink-0" disabled={slug.length < 3}>Join</button>
          </form>
        </div>
        <div className="order-1 md:order-2 relative">
          <div className="absolute inset-x-6 bottom-6 top-10 rounded-[3rem] bg-gradient-to-b from-lilac-soft to-coral-soft" aria-hidden="true" />
          <ToyTrio
            className="relative h-[300px] md:h-[440px]"
            avatars={[
              { body: 'cat', color: 'sky', accent: 'butter', accessory: 'headphones' },
              { body: 'bear', color: 'coral', accent: 'cloud', accessory: 'flower' },
              { body: 'bot', color: 'mint', accent: 'tangerine', accessory: 'none' },
            ]}
          />
        </div>
      </section>

      <section className="w-full max-w-5xl mx-auto px-5 pb-12 grid sm:grid-cols-3 gap-3">
        {[
          { icon: 'camera' as const, t: 'Scan & make a toy', d: 'A nickname and a few taps. Under 30 seconds.' },
          { icon: 'play' as const, t: 'Wave, play, chat', d: 'Quick games and icebreakers that give you a reason to talk.' },
          { icon: 'pin' as const, t: 'Meet in real life', d: 'Invite someone to a real spot at the venue. Both have to say yes.' },
        ].map((s) => (
          <div key={s.t} className="card p-5">
            <div className="w-10 h-10 rounded-2xl bg-cream grid place-items-center mb-3"><Icon name={s.icon} /></div>
            <h2 className="font-display font-semibold text-lg mb-1">{s.t}</h2>
            <p className="text-sm text-ink-mute">{s.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
