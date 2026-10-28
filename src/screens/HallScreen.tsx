// The shared hall: full-screen 3D world with a light HUD on top.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZONES, SPOT_SLOTS } from '../../shared/content.ts';
import type { Invite } from '../../shared/protocol.ts';
import { client, useEvent } from '../lib/client.ts';
import { Icon, IconButton, Spinner, ToyBadge, toast } from '../components/ui.tsx';
import { Hall } from '../three/Hall.tsx';
import { IncomingInvite, InvitesSheet, MeSheet, MeetupConfirm, PeopleSheet, ProfileSheet, SpotsSheet } from './Panels.tsx';
import { GameOverlay } from './GameOverlay.tsx';

type SheetName = 'people' | 'invites' | 'me' | 'spots' | null;

export function HallScreen({ onLeft }: { onLeft: () => void }) {
  const event = useEvent((s) => s.event)!;
  const selfId = useEvent((s) => s.selfId)!;
  const record = useEvent((s) => s.participants);
  const blocked = useEvent((s) => s.blocked);
  const effects = useEvent((s) => s.effects);
  const invites = useEvent((s) => s.invites);
  const feed = useEvent((s) => s.feed);
  const game = useEvent((s) => s.game);
  const conn = useEvent((s) => s.conn);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileView, setProfileView] = useState<'main' | 'meet'>('main');
  const [sheet, setSheet] = useState<SheetName>(null);
  const [overview, setOverview] = useState(false);
  const [intro, setIntro] = useState(true);
  const [confirm, setConfirm] = useState<Invite | null>(null);

  const participants = useMemo(() => Object.values(record).filter((p) => !blocked.includes(p.id)), [record, blocked]);
  const others = participants.filter((p) => p.id !== selfId);
  const realOthers = others.filter((p) => !p.isBot);
  const me = record[selfId];

  const inviteList = useMemo(() => Object.values(invites).sort((a, b) => b.createdAt - a.createdAt), [invites]);
  const incoming = inviteList.filter((i) => i.to === selfId && i.status === 'pending' && !blocked.includes(i.from));
  const pendingCount = incoming.length;

  // React to invite changes: toasts for outgoing results, confirmation for meetups.
  const prev = useRef<Record<string, Invite['status']>>({});
  useEffect(() => {
    for (const inv of inviteList) {
      const before = prev.current[inv.id];
      if (before === inv.status) continue;
      prev.current[inv.id] = inv.status;
      if (!before && inv.status !== 'pending') continue; // history loaded on join
      const otherId = inv.from === selfId ? inv.to : inv.from;
      const name = record[otherId]?.nickname ?? 'They';
      const mine = inv.from === selfId;
      if (inv.status === 'accepted' && inv.type === 'meetup') setConfirm(inv);
      if (mine && inv.status === 'declined') toast(inv.note ?? `${name} can’t right now`, 'neutral');
      if (mine && inv.status === 'expired') toast(`Your invite to ${name} expired`);
      if (!mine && inv.status === 'cancelled' && before === 'pending') toast(`${name} withdrew their invite`);
      if (inv.status === 'cancelled' && before === 'accepted') toast(`Meetup with ${name} was called off`);
    }
  }, [inviteList, record, selfId]);

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Feed cards disappear on their own.
  useEffect(() => {
    if (!feed.length) return;
    const t = setTimeout(() => client.dismissFeed(feed[feed.length - 1].id), 6000);
    return () => clearTimeout(t);
  }, [feed]);

  const walkTo = useCallback((x: number, z: number) => {
    setIntro(false);
    setOverview(false);
    client.moveSelf(x + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 1.2);
  }, []);
  const onTapFloor = useCallback((x: number, z: number) => {
    setIntro(false);
    client.moveSelf(x, z);
  }, []);
  const onTapToy = useCallback(
    (id: string) => {
      setIntro(false);
      if (id === selfId) setSheet('me');
      else {
        setProfileView('main');
        setProfileId(id);
      }
    },
    [selfId],
  );

  const openProfile = (id: string, view: 'main' | 'meet' = 'main') => {
    setSheet(null);
    setProfileView(view);
    setProfileId(id);
  };

  const share = async () => {
    const url = `${location.origin}/e/${event.id}`;
    try {
      if (navigator.share) await navigator.share({ title: event.name, text: 'Join me in Tiny Crowd', url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied', 'success');
      }
    } catch {
      /* user cancelled */
    }
  };

  const profile = profileId ? record[profileId] : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#F2E8F7] select-none">
      <Hall
        participants={participants}
        selfId={selfId}
        effects={effects}
        spots={event.spots}
        overview={overview}
        focusId={null}
        onTapFloor={onTapFloor}
        onTapToy={onTapToy}
      />

      {/* Top bar */}
      <div className="absolute z-10 inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
        <button
          className="pointer-events-auto glass rounded-full h-12 pl-3 pr-4 flex items-center gap-2 min-w-0 max-w-[70%] text-left"
          onClick={() => setSheet('people')}
          aria-label={`${event.name}. ${participants.length} here. Show people`}
        >
          <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
            <span className={`absolute inset-0 rounded-full ${conn === 'connected' ? 'bg-mint animate-ping opacity-60' : ''}`} />
            <span className={`relative w-2.5 h-2.5 rounded-full ${conn === 'connected' ? 'bg-mint' : 'bg-butter'}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold truncate leading-tight">{event.name}</span>
            <span className="block text-xs text-ink-mute leading-tight">
              {realOthers.length + 1} here{others.length > realOthers.length ? ` · ${others.length - realOthers.length} demo` : ''}
            </span>
          </span>
        </button>
        <div className="pointer-events-auto flex gap-2">
          <IconButton icon="users" label="People here" onClick={() => setSheet('people')} className="hidden sm:grid" />
          <IconButton icon="bell" label={`Invites${pendingCount ? `, ${pendingCount} waiting` : ''}`} badge={pendingCount} onClick={() => setSheet('invites')} />
        </div>
      </div>

      {/* Connection banner */}
      {conn !== 'connected' && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)] z-20 animate-pop">
          <div className={`rounded-full px-4 py-2 text-sm font-semibold shadow-float flex items-center gap-2 ${conn === 'offline' || conn === 'failed' ? 'bg-danger text-white' : 'bg-butter text-ink'}`} role="status">
            {conn === 'offline' || conn === 'failed' ? (
              <>
                <Icon name="wifiOff" size={16} /> Connection lost
                <button className="underline underline-offset-2" onClick={() => client.retry()}>Retry</button>
              </>
            ) : (
              <>
                <Spinner className="w-3.5 h-3.5" /> Reconnecting…
              </>
            )}
          </div>
        </div>
      )}

      {/* Incoming waves & messages */}
      <div className="absolute z-[35] left-3 right-3 sm:right-auto sm:w-80 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)] flex flex-col gap-2 pointer-events-none">
        {incoming[0] ? (
          <IncomingInvite invite={incoming[0]} from={record[incoming[0].from]} spots={event.spots} more={incoming.length - 1} onOpenAll={() => setSheet('invites')} />
        ) : (
          feed.slice(0, 2).map((f) => {
            const who = f.from ? record[f.from] : undefined;
            return (
              <div key={f.id} className="pointer-events-auto glass rounded-3xl p-2.5 pr-3 flex items-center gap-2.5 animate-pop">
                {who ? <ToyBadge avatar={who.avatar} size={36} /> : <span className="text-2xl">✨</span>}
                <p className="text-sm font-medium flex-1 min-w-0 leading-snug">{f.text}</p>
                {who && (
                  <button
                    className="btn-primary btn-sm h-8 px-3 shrink-0"
                    onClick={() => {
                      if (f.kind === 'icebreaker') openProfile(who.id);
                      else {
                        client.wave(who.id).then((r) => !r.ok && toast(r.error, 'error'));
                        client.emote('wave');
                      }
                      client.dismissFeed(f.id);
                    }}
                  >
                    {f.kind === 'icebreaker' ? 'Reply' : 'Wave back'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Intro: "The Drop" */}
      {intro && (
        <button className="absolute z-10 inset-x-0 top-[38%] flex justify-center px-6 animate-pop" onClick={() => setIntro(false)} aria-label="Dismiss welcome message">
          <div className="glass rounded-4xl px-6 py-4 text-center shadow-float">
            <p className="font-display text-2xl font-bold">You’re in! Find your people.</p>
            <p className="text-sm text-ink-mute mt-1">Tap the floor to walk · tap a toy to say hi</p>
          </div>
        </button>
      )}

      {/* Empty state */}
      {!intro && realOthers.length === 0 && (
        <div className="absolute z-10 inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] flex justify-center pointer-events-none">
          <div className="pointer-events-auto glass rounded-3xl p-3 max-w-sm w-full flex items-center gap-3 animate-rise">
            <span className="text-3xl" aria-hidden="true">🎈</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">You’re the first one here</p>
              <p className="text-xs text-ink-mute">
                {others.length ? 'The toys marked “demo” are bots to try things with.' : 'Others will pop in as they scan the code.'}
              </p>
            </div>
            <button className="btn-secondary btn-sm shrink-0" onClick={share}>Share</button>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav
        aria-label="Hall navigation"
        className="absolute z-10 inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-end justify-between gap-2 pointer-events-none"
      >
        <button className="pointer-events-auto glass rounded-full w-14 h-14 grid place-items-center" onClick={() => setSheet('me')} aria-label="My toy and settings">
          {me && <ToyBadge avatar={me.avatar} size={46} />}
        </button>
        <div className="pointer-events-auto glass rounded-full h-14 px-1.5 flex items-center justify-around flex-1 max-w-xs">
          {ZONES.map((z) => (
            <NavItem key={z.id} label={z.id === 'main' ? 'Hall' : z.id === 'coffee' ? 'Coffee' : 'Play'} onClick={() => walkTo(z.x, z.z)}>
              {z.id === 'main' ? <Icon name="home" size={20} /> : <span className="text-lg leading-none">{z.id === 'coffee' ? '☕' : '🎲'}</span>}
            </NavItem>
          ))}
          <NavItem label="Spots" onClick={() => setSheet('spots')}>
            <Icon name="pin" size={20} />
          </NavItem>
        </div>
        <IconButton
          icon={overview ? 'zoomIn' : 'zoomOut'}
          label={overview ? 'Zoom back to my toy' : 'See the whole hall'}
          pressed={overview}
          onClick={() => setOverview((o) => !o)}
          className="pointer-events-auto w-14 h-14"
        />
      </nav>

      {/* Sheets */}
      <ProfileSheet
        participant={profile}
        view={profileView}
        setView={setProfileView}
        spots={event.spots}
        invites={inviteList}
        selfId={selfId}
        onClose={() => setProfileId(null)}
      />
      <PeopleSheet open={sheet === 'people'} onClose={() => setSheet(null)} participants={others} me={me} onPick={(id) => openProfile(id)} onShare={share} />
      <InvitesSheet open={sheet === 'invites'} onClose={() => setSheet(null)} invites={inviteList} selfId={selfId} record={record} spots={event.spots} />
      <MeSheet
        open={sheet === 'me'}
        onClose={() => setSheet(null)}
        me={me}
        eventName={event.name}
        onLeave={async () => {
          await client.leave();
          onLeft();
        }}
      />
      <SpotsSheet
        open={sheet === 'spots'}
        onClose={() => setSheet(null)}
        spots={event.spots}
        onGo={(i) => {
          setSheet(null);
          walkTo(SPOT_SLOTS[i].x, SPOT_SLOTS[i].z + 1);
        }}
      />
      {confirm && (
        <MeetupConfirm
          invite={confirm}
          other={record[confirm.from === selfId ? confirm.to : confirm.from]}
          me={me}
          spots={event.spots}
          onClose={() => setConfirm(null)}
          onWalk={() => {
            const i = event.spots.findIndex((s) => s.id === confirm.spotId);
            if (i >= 0) walkTo(SPOT_SLOTS[i].x, SPOT_SLOTS[i].z + 1);
            setConfirm(null);
          }}
        />
      )}
      {game && (
        <GameOverlay
          game={game}
          selfId={selfId}
          record={record}
          onClose={() => client.leaveGame()}
          onMeet={(id) => {
            client.leaveGame();
            openProfile(id, 'meet');
          }}
        />
      )}
    </div>
  );
}

function NavItem({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="h-12 min-w-[3.25rem] px-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 hover:bg-ink/5 active:bg-ink/10" onClick={onClick}>
      {children}
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}
