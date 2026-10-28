// Attendee journey for one event: welcome → create toy → hall.
import { useEffect, useState } from 'react';
import type { Avatar } from '../../shared/content.ts';
import { randomAvatar } from '../lib/avatar.ts';
import type { EventInfo } from '../../shared/protocol.ts';
import { client, useEvent } from '../lib/client.ts';
import { loadProfile, loadSession } from '../lib/storage.ts';
import { navigate } from '../lib/router.ts';
import { Icon, Spinner, Wordmark, toast } from '../components/ui.tsx';
import { ToyPreview } from '../three/ToyPreview.tsx';
import { FullLoader } from '../App.tsx';
import { Creator } from './Creator.tsx';
import { HallScreen } from './HallScreen.tsx';

type Load = { s: 'loading' } | { s: 'ok'; event: EventInfo; online: number } | { s: 'notfound' } | { s: 'error' };

export default function EventFlow({ eventId }: { eventId: string }) {
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [step, setStep] = useState<'welcome' | 'create' | 'joining'>('welcome');
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinedHere = useEvent((s) => s.selfId !== null && s.event?.id === eventId);
  const saved = loadSession(eventId);
  const [draft, setDraft] = useState<{ nickname: string; avatar: Avatar }>(() => {
    const p = saved ?? loadProfile();
    return p ? { nickname: p.nickname, avatar: p.avatar } : { nickname: '', avatar: randomAvatar() };
  });

  const fetchInfo = () => {
    setLoad({ s: 'loading' });
    fetch(`/api/events/${eventId}`)
      .then(async (r) => {
        if (r.status === 404) return setLoad({ s: 'notfound' });
        if (!r.ok) throw new Error();
        const d = await r.json();
        setLoad({ s: 'ok', event: d.event, online: d.online });
      })
      .catch(() => setLoad({ s: 'error' }));
  };
  useEffect(fetchInfo, [eventId]);

  async function join(nickname: string, avatar: Avatar) {
    setDraft({ nickname, avatar });
    setStep('joining');
    setJoinError(null);
    const res = await client.join(eventId, nickname, avatar);
    if (!res.ok) {
      setJoinError(res.error);
      setStep('create');
      toast(res.error, 'error');
    }
  }

  if (joinedHere) return <HallScreen onLeft={() => setStep('welcome')} />;
  if (load.s === 'loading') return <FullLoader label="Finding your event…" />;
  if (load.s === 'notfound')
    return (
      <Problem
        title="We can’t find that event"
        body="The link or QR code might be mistyped, or the event has ended. Ask the organizer for a fresh link."
        action={<button className="btn-primary btn-lg" onClick={() => navigate('/')}>Go to Tiny Crowd</button>}
      />
    );
  if (load.s === 'error')
    return (
      <Problem
        title="Can’t reach the event"
        body="Check your Wi-Fi or mobile data, then try again."
        action={<button className="btn-primary btn-lg" onClick={fetchInfo}>Try again</button>}
      />
    );

  if (step === 'joining')
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <ToyPreview avatar={draft.avatar} className="w-48 h-56" pedestal={false} waveKey={1} />
          <div className="flex items-center gap-2 font-semibold"><Spinner className="w-4 h-4" /> Dropping you in…</div>
        </div>
      </div>
    );

  if (step === 'create')
    return <Creator event={load.event} initial={draft} error={joinError} onBack={() => setStep('welcome')} onDone={join} />;

  return (
    <Welcome
      event={load.event}
      online={load.online}
      avatar={draft.avatar}
      returning={saved ? saved.nickname : null}
      onStart={() => setStep('create')}
      onResume={() => saved && join(saved.nickname, saved.avatar)}
    />
  );
}

function Welcome({
  event,
  online,
  avatar,
  returning,
  onStart,
  onResume,
}: {
  event: EventInfo;
  online: number;
  avatar: Avatar;
  returning: string | null;
  onStart: () => void;
  onResume: () => void;
}) {
  return (
    <main className="min-h-dvh flex flex-col max-w-md mx-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <Wordmark small />
        <span className="chip bg-paper border border-line text-ink-soft max-w-[55%]">
          <span className="w-2 h-2 rounded-full bg-mint shrink-0" aria-hidden="true" />
          <span className="truncate">{event.name}</span>
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="relative w-full">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-56 h-56 rounded-full bg-gradient-to-b from-lilac-soft to-coral-soft" aria-hidden="true" />
          <ToyPreview avatar={avatar} className="relative h-[min(46dvh,340px)]" />
        </div>
        <h1 className="text-3xl font-bold mt-2 mb-2 animate-rise">{returning ? `Welcome back, ${returning}.` : 'Your tiny self awaits.'}</h1>
        <p className="text-ink-soft text-lg animate-rise">Meet people without the awkward introduction.</p>
        {online > 0 && (
          <p className="mt-3 text-sm text-ink-mute">
            <Icon name="users" size={16} className="inline -mt-0.5 mr-1" />
            {online} {online === 1 ? 'person is' : 'people are'} already in the hall
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {returning ? (
          <>
            <button className="btn-primary btn-lg w-full" onClick={onResume}>Jump back in</button>
            <button className="btn-ghost btn-md w-full" onClick={onStart}>Change my toy</button>
          </>
        ) : (
          <button className="btn-primary btn-lg w-full" onClick={onStart}>Create my toy</button>
        )}
        <p className="text-xs text-ink-mute text-center mt-2">
          A nickname is all you need. No account, no email, no contact details shared.
        </p>
      </div>
    </main>
  );
}

function Problem({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-center">
      <div className="max-w-sm animate-rise">
        <div className="text-5xl mb-4" aria-hidden="true">🧭</div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-ink-mute mb-6">{body}</p>
        {action}
      </div>
    </main>
  );
}
