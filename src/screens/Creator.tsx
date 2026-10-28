// "Make it yours." — pick a character, colors and an accessory, then a nickname.
import { useRef, useState } from 'react';
import { ACCESSORIES, BODIES, COLORS, type Avatar, type ColorId } from '../../shared/content.ts';
import { nicknameSchema, type EventInfo } from '../../shared/protocol.ts';
import { Icon, ToyBadge, toast } from '../components/ui.tsx';
import { ToyPreview } from '../three/ToyPreview.tsx';
import { colorsFromPhoto } from '../lib/photoColors.ts';
import { randomAvatar } from '../lib/avatar.ts';

type Tab = 'character' | 'colors' | 'extras';

export function Creator({
  event,
  initial,
  error,
  onBack,
  onDone,
}: {
  event: EventInfo;
  initial: { nickname: string; avatar: Avatar };
  error: string | null;
  onBack: () => void;
  onDone: (nickname: string, avatar: Avatar) => void;
}) {
  const [avatar, setAvatar] = useState<Avatar>(initial.avatar);
  const [nickname, setNickname] = useState(initial.nickname);
  const [touched, setTouched] = useState(false);
  const [tab, setTab] = useState<Tab>('character');
  const [waveKey, setWaveKey] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = nicknameSchema.safeParse(nickname);
  const nickError = !parsed.success ? parsed.error.issues[0]?.message : null;
  const showNickError = touched && nickname.length > 0 && nickError;

  const update = (p: Partial<Avatar>) => {
    setAvatar((a) => ({ ...a, ...p }));
    setWaveKey((k) => k + 1);
  };

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const c = await colorsFromPhoto(file);
      update(c);
      setTab('colors');
      toast('Colors picked from your photo', 'success');
    } catch {
      toast('Couldn’t read that photo — try another', 'error');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (parsed.success) onDone(parsed.data, avatar);
  };

  return (
    <form onSubmit={submit} className="min-h-dvh flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="btn-ghost btn-sm" onClick={onBack} aria-label="Back">
          <Icon name="arrowLeft" size={20} /> Back
        </button>
        <span className="hidden sm:block text-sm text-ink-mute truncate max-w-[40%]">{event.name}</span>
        <button type="button" className="btn-ghost btn-sm" onClick={() => { setAvatar(randomAvatar()); setWaveKey((k) => k + 1); }}>
          <Icon name="shuffle" size={18} /> <span className="whitespace-nowrap">Surprise me</span>
        </button>
      </header>

      <div className="px-5">
        <h1 className="text-2xl font-bold mt-1">Make it yours.</h1>
        <p className="text-ink-mute text-sm">Pick a look, choose a nickname, and join the crowd.</p>
      </div>

      <div className="relative mx-5 mt-3 rounded-4xl bg-gradient-to-b from-lilac-soft to-coral-soft overflow-hidden">
        <ToyPreview avatar={avatar} className="h-[min(30dvh,260px)]" waveKey={waveKey} zoom={1.15} />
        <button
          type="button"
          className="absolute right-3 bottom-3 btn bg-paper/90 text-ink h-9 px-3 text-xs shadow-card"
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
        >
          <Icon name="camera" size={16} /> {photoBusy ? 'Reading…' : 'Colors from a photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>
      <p className="mx-5 mt-1.5 text-[11px] text-ink-mute">Optional. Your photo never leaves your phone — we only pick two colors from it.</p>

      <div className="px-5 mt-4">
        <label htmlFor="nick" className="label">Nickname</label>
        <input
          id="nick"
          className={`input mt-1.5 ${showNickError ? 'border-danger focus:border-danger' : ''}`}
          placeholder="What should people call you?"
          value={nickname}
          maxLength={18}
          autoComplete="nickname"
          enterKeyHint="go"
          onChange={(e) => setNickname(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={!!showNickError}
          aria-describedby="nick-help"
        />
        <p id="nick-help" className={`text-xs mt-1.5 ${showNickError ? 'text-danger font-medium' : 'text-ink-mute'}`}>
          {showNickError ? nickError : error ?? 'Shown to other attendees. First name or a fun alias both work.'}
        </p>
      </div>

      <div className="px-5 mt-4" role="tablist" aria-label="Customize">
        <div className="flex gap-1 p-1 bg-cream-deep rounded-full">
          {(['character', 'colors', 'extras'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 h-10 rounded-full text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-paper shadow-card text-ink' : 'text-ink-mute'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-3 min-h-[124px]" role="tabpanel">
        {tab === 'character' && (
          <div className="grid grid-cols-5 gap-2">
            {BODIES.map((b) => (
              <Option key={b.id} selected={avatar.body === b.id} onClick={() => update({ body: b.id })} label={b.label}>
                <ToyBadge avatar={{ ...avatar, body: b.id }} size={46} />
              </Option>
            ))}
          </div>
        )}
        {tab === 'colors' && (
          <div className="space-y-3">
            <Swatches label="Main" value={avatar.color} onChange={(color) => update({ color })} />
            <Swatches label="Accent" value={avatar.accent} onChange={(accent) => update({ accent })} />
          </div>
        )}
        {tab === 'extras' && (
          <div className="grid grid-cols-4 gap-2">
            {ACCESSORIES.map((a) => (
              <Option key={a.id} selected={avatar.accessory === a.id} onClick={() => update({ accessory: a.id })} label={a.label}>
                <span className="text-2xl" aria-hidden="true">{ACC_EMOJI[a.id]}</span>
              </Option>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-cream via-cream to-cream/0">
        <button type="submit" className="btn-accent btn-lg w-full" disabled={touched && !parsed.success}>
          Drop me into the hall
        </button>
      </div>
    </form>
  );
}

const ACC_EMOJI: Record<string, string> = {
  none: '∅',
  headphones: '🎧',
  glasses: '👓',
  beanie: '🧢',
  partyhat: '🥳',
  flower: '🌸',
  scarf: '🧣',
};

function Option({ selected, onClick, label, children }: { selected: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1 rounded-2xl py-2 border-2 transition-colors ${
        selected ? 'border-ink bg-paper' : 'border-transparent bg-paper/60 hover:bg-paper'
      }`}
    >
      <span className="h-12 grid place-items-center">{children}</span>
      <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
    </button>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: ColorId; onChange: (c: ColorId) => void }) {
  return (
    <fieldset>
      <legend className="label mb-1.5">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-label={c.label}
            aria-pressed={value === c.id}
            className={`w-9 h-9 rounded-full border-2 grid place-items-center transition-transform active:scale-90 ${value === c.id ? 'border-ink scale-110' : 'border-black/5'}`}
            style={{ background: c.hex }}
          >
            {value === c.id && <Icon name="check" size={16} stroke={3} className={c.id === 'ink' ? 'text-white' : 'text-ink'} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
