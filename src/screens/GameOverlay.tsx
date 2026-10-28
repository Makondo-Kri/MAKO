// "Sync Up": two people answer five quick this-or-thats at the same time.
// Matching answers fill a shared meter. Nobody loses; the result is a
// conversation starter.
import { useEffect, useState } from 'react';
import type { GameState, PublicParticipant } from '../../shared/protocol.ts';
import { client } from '../lib/client.ts';
import { Icon, ToyBadge } from '../components/ui.tsx';

export function GameOverlay({
  game: g,
  selfId,
  record,
  onClose,
  onMeet,
}: {
  game: GameState;
  selfId: string;
  record: Record<string, PublicParticipant>;
  onClose: () => void;
  onMeet: (otherId: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [mine, setMine] = useState<{ round: number; choice: 0 | 1 } | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const meIdx = g.players[0] === selfId ? 0 : 1;
  const otherId = g.players[1 - meIdx];
  const me = record[selfId];
  const other = record[otherId];
  const otherName = other?.nickname ?? 'Your partner';
  const left = Math.max(0, g.deadline - now);
  const myChoice = mine?.round === g.round ? mine.choice : null;
  const otherAnswered = g.answered.includes(otherId);
  const last = g.history[g.history.length - 1];

  const answer = (choice: 0 | 1) => {
    if (myChoice !== null || g.phase !== 'question') return;
    setMine({ round: g.round, choice });
    client.answer(g.id, g.round, choice);
  };

  return (
    <div className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Sync Up game">
      <div className="w-full sm:max-w-md bg-paper rounded-t-4xl sm:rounded-4xl shadow-float p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-rise min-h-[70dvh] sm:min-h-0 flex flex-col">
        <header className="flex items-center justify-between mb-4">
          <div>
            <p className="label">Mini-game</p>
            <h2 className="text-xl font-bold">Sync Up</h2>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label={g.phase === 'done' || g.phase === 'abandoned' ? 'Back to hall' : 'Leave game'}>
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* players + sync meter */}
        <div className="flex items-center gap-3 mb-5">
          {me && <ToyBadge avatar={me.avatar} size={44} />}
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold text-ink-mute mb-1">
              <span>You</span>
              <span>{g.matches} / {g.rounds} in sync</span>
              <span className="truncate max-w-[30%]">{otherName}</span>
            </div>
            <div className="h-3 rounded-full bg-cream-deep overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={g.rounds} aria-valuenow={g.matches} aria-label="Sync meter">
              <div className="h-full rounded-full bg-gradient-to-r from-lilac to-coral transition-[width] duration-500" style={{ width: `${(g.matches / g.rounds) * 100}%` }} />
            </div>
          </div>
          {other && <ToyBadge avatar={other.avatar} size={44} />}
        </div>

        <div className="flex-1 flex flex-col justify-center">
          {g.phase === 'countdown' && (
            <div className="text-center py-6">
              <p className="text-ink-mute mb-2">Answer at the same time as {otherName}. Match to fill the meter.</p>
              <p className="font-display text-6xl font-bold animate-pop" key={Math.ceil(left / 1000)}>{Math.max(1, Math.ceil(left / 1000))}</p>
            </div>
          )}

          {g.phase === 'question' && g.question && (
            <div>
              <p className="text-center text-xs font-semibold text-ink-mute mb-1">Question {g.round + 1} of {g.rounds}</p>
              <h3 className="text-center text-2xl font-bold mb-5">{g.question[0]}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((i) => {
                  const c = (i - 1) as 0 | 1;
                  const picked = myChoice === c;
                  return (
                    <button
                      key={i}
                      onClick={() => answer(c)}
                      disabled={myChoice !== null}
                      className={`h-28 rounded-3xl text-lg font-bold transition-all active:scale-95 border-2 ${
                        picked ? 'bg-ink text-paper border-ink scale-[1.02]' : myChoice !== null ? 'bg-cream text-ink-mute border-transparent' : i === 1 ? 'bg-lilac-soft border-transparent' : 'bg-coral-soft border-transparent'
                      }`}
                    >
                      {g.question![i]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-cream-deep overflow-hidden" aria-hidden="true">
                <div className="h-full bg-ink/70 transition-[width] duration-200 ease-linear" style={{ width: `${(left / 9000) * 100}%` }} />
              </div>
              <p className="text-center text-sm text-ink-mute mt-3" aria-live="polite">
                {myChoice !== null
                  ? otherAnswered ? 'Both in — revealing…' : `Waiting for ${otherName}…`
                  : otherAnswered ? `${otherName} has answered ✓` : 'Go with your gut'}
              </p>
            </div>
          )}

          {g.phase === 'reveal' && last && (
            <div className="text-center py-2 animate-pop">
              <p className="text-sm text-ink-mute mb-3">{last.q[0]}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Answer label="You" value={last.a[meIdx] === null ? '—' : last.q[(last.a[meIdx] as number) + 1]} />
                <Answer label={otherName} value={last.a[1 - meIdx] === null ? '—' : last.q[(last.a[1 - meIdx] as number) + 1]} />
              </div>
              <p className="font-display text-2xl font-bold">
                {last.a[0] !== null && last.a[0] === last.a[1] ? 'In sync! ✨' : last.a[0] === null || last.a[1] === null ? 'Too slow! ⏱️' : 'Opposites attract 🧲'}
              </p>
            </div>
          )}

          {g.phase === 'done' && <Done g={g} meIdx={meIdx} otherName={otherName} onMeet={() => onMeet(otherId)} onClose={onClose} canMeet={!!other} />}

          {g.phase === 'abandoned' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2" aria-hidden="true">👋</div>
              <p className="font-semibold text-lg">{g.abandonedBy === selfId ? 'You left the game' : `${otherName} had to go`}</p>
              <p className="text-sm text-ink-mute mb-5">No worries — there are plenty more people in the hall.</p>
              <button className="btn-primary btn-lg w-full" onClick={onClose}>Back to the hall</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Answer({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-cream p-3">
      <p className="text-xs text-ink-mute truncate">{label}</p>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
}

function Done({ g, meIdx, otherName, onMeet, onClose, canMeet }: { g: GameState; meIdx: number; otherName: string; onMeet: () => void; onClose: () => void; canMeet: boolean }) {
  const diff = g.history.find((h) => h.a[0] !== null && h.a[1] !== null && h.a[0] !== h.a[1]);
  const same = g.history.find((h) => h.a[0] !== null && h.a[0] === h.a[1]);
  const prompt = diff
    ? `Ask ${otherName} why they picked ${diff.q[(diff.a[1 - meIdx] as number) + 1]} over ${diff.q[(diff.a[meIdx] as number) + 1]}.`
    : same
      ? `You both picked ${same.q[(same.a[0] as number) + 1]}. Compare notes!`
      : `Ask ${otherName} what brought them here today.`;
  const title = g.matches >= 4 ? 'Practically twins 👯' : g.matches >= 2 ? 'Nicely in sync 🎶' : 'Opposites attract 🧲';
  return (
    <div className="text-center animate-pop">
      <p className="label text-lilac-deep">Result</p>
      <h3 className="text-3xl font-bold mt-1">{title}</h3>
      <p className="text-ink-mute mb-4">You matched {g.matches} of {g.rounds}.</p>
      <div className="rounded-3xl bg-butter-soft p-4 text-left mb-5">
        <p className="label mb-1">Conversation starter</p>
        <p className="font-medium">{prompt}</p>
      </div>
      <div className="flex flex-col gap-2">
        {canMeet && <button className="btn-accent btn-lg" onClick={onMeet}>Invite {otherName} to meet up</button>}
        <button className="btn-secondary btn-md" onClick={onClose}>Back to the hall</button>
      </div>
    </div>
  );
}
