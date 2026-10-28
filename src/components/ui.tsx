// Design-system primitives. Screens compose these instead of restyling things.
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { colorHex, type Avatar } from '../../shared/content.ts';

// ---------------- Icons (24px, 2px stroke, rounded) ----------------
const paths = {
  close: 'M6 6l12 12M18 6L6 18',
  bell: 'M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0',
  home: 'M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-5h-6v5H5a1 1 0 01-1-1v-8z',
  pin: 'M12 21s-6-5.6-6-10.5A6 6 0 0118 10.5C18 15.4 12 21 12 21zm0-8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  play: 'M8 5.5v13l10-6.5-10-6.5z',
  chat: 'M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  hand: 'M8 13V6.5a1.5 1.5 0 013 0V12m0-6.5V5a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4.6 14a1.5 1.5 0 012.5-1.6L8 13.5',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20a6 6 0 0112 0M16 4.5a3.5 3.5 0 010 6.5M18 14.5A6 6 0 0121 20',
  zoomOut: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  zoomIn: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  door: 'M14 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 16l4-4-4-4M14 12H4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  camera: 'M4 8a2 2 0 012-2h1.5l1.5-2h6l1.5 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8zm8 8a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  shuffle: 'M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.8-3.5M14 9.5C15 8 16 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 015-2.7M19 13a10 10 0 00-2.3-1.6M2 9.5a15 15 0 014.3-2.8M22 9.5A15 15 0 0011 6',
  arrowLeft: 'M19 12H5m6-6l-6 6 6 6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z',
  download: 'M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14',
} as const;
export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, className = '', stroke = 2 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  badge,
  className = '',
  pressed,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  badge?: number;
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`relative grid place-items-center w-12 h-12 rounded-full glass text-ink active:scale-95 transition-transform ${className}`}
    >
      <Icon name={icon} />
      {!!badge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-coral text-white text-[11px] font-bold grid place-items-center animate-pulseRing">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Wordmark({ className = '', small = false }: { className?: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold tracking-tight ${small ? 'text-base' : 'text-xl'} ${className}`}>
      <svg width={small ? 22 : 28} height={small ? 22 : 28} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="#1E1B2E" />
        <ellipse cx="32" cy="36" rx="17" ry="19" fill="#FF7A5C" />
        <circle cx="26" cy="33" r="3" fill="#1E1B2E" />
        <circle cx="38" cy="33" r="3" fill="#1E1B2E" />
        <path d="M28 41q4 3 8 0" stroke="#1E1B2E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
      Tiny&nbsp;Crowd
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block w-5 h-5 rounded-full border-[2.5px] border-current border-r-transparent animate-spin ${className}`} role="status" aria-label="Loading" />;
}

// ---------------- Toy badge: a flat 2D portrait used in lists and cards ----------------
export function ToyBadge({ avatar, size = 40, ring }: { avatar: Avatar; size?: number; ring?: boolean }) {
  const c = colorHex(avatar.color);
  const a = colorHex(avatar.accent);
  const ink = '#231F33';
  const isBot = avatar.body === 'bot';
  return (
    <span
      className={`inline-grid place-items-center rounded-full shrink-0 ${ring ? 'ring-2 ring-paper shadow-card' : ''}`}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${c} 22%, #FFFDF9)` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" width={size * 0.86} height={size * 0.86}>
        {avatar.body === 'bear' && (
          <>
            <circle cx="10" cy="11" r="5" fill={c} />
            <circle cx="30" cy="11" r="5" fill={c} />
            <circle cx="10" cy="11" r="2.5" fill={a} />
            <circle cx="30" cy="11" r="2.5" fill={a} />
          </>
        )}
        {avatar.body === 'cat' && (
          <>
            <path d="M7 16 L9 4 L17 11 Z" fill={c} />
            <path d="M33 16 L31 4 L23 11 Z" fill={c} />
          </>
        )}
        {avatar.body === 'sprout' && (
          <>
            <path d="M20 9 V4" stroke="#3FA56F" strokeWidth="1.6" />
            <ellipse cx="16.5" cy="4.5" rx="4" ry="2" fill={a} transform="rotate(-25 16.5 4.5)" />
            <ellipse cx="23.5" cy="4" rx="4" ry="2" fill={a} transform="rotate(25 23.5 4)" />
          </>
        )}
        {isBot ? (
          <>
            <line x1="20" y1="8" x2="20" y2="3" stroke={ink} strokeWidth="1.5" />
            <circle cx="20" cy="3" r="2" fill={a} />
            <rect x="5" y="8" width="30" height="26" rx="9" fill={c} />
            <rect x="9.5" y="14" width="21" height="13" rx="4" fill={ink} />
            <ellipse cx="15.5" cy="20.5" rx="2" ry="2.6" fill="#9FF5D3" />
            <ellipse cx="24.5" cy="20.5" rx="2" ry="2.6" fill="#9FF5D3" />
          </>
        ) : (
          <>
            <ellipse cx="20" cy="22" rx="15" ry={avatar.body === 'bean' ? 15 : 13.5} fill={c} />
            <ellipse cx="14.5" cy="21" rx="1.9" ry="2.5" fill={ink} />
            <ellipse cx="25.5" cy="21" rx="1.9" ry="2.5" fill={ink} />
            <ellipse cx="10.5" cy="25" rx="2.4" ry="1.5" fill="#FF8FA3" opacity=".6" />
            <ellipse cx="29.5" cy="25" rx="2.4" ry="1.5" fill="#FF8FA3" opacity=".6" />
            <path d="M18 25.5 q2 2 4 0" stroke={ink} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}

// ---------------- Sheet: bottom sheet on phones, centred dialog on larger screens ----------------
export function Sheet({
  open,
  onClose,
  children,
  label,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissable && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, dismissable, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-ink/25 animate-[rise_.2s_ease-out_both]" onClick={() => dismissable && onClose()} />
      <div
        ref={ref}
        tabIndex={-1}
        className="relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto bg-paper rounded-t-4xl sm:rounded-4xl shadow-float p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-rise outline-none"
      >
        <div className="sm:hidden mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

// ---------------- Toasts ----------------
type ToastT = { id: number; text: string; tone: 'neutral' | 'success' | 'error' };
let toasts: ToastT[] = [];
const tl = new Set<() => void>();
let tid = 0;
export function toast(text: string, tone: ToastT['tone'] = 'neutral') {
  const id = ++tid;
  toasts = [...toasts.slice(-2), { id, text, tone }];
  tl.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    tl.forEach((l) => l());
  }, 2800);
}
export function Toaster() {
  const list = useSyncExternalStore(
    (f) => {
      tl.add(f);
      return () => tl.delete(f);
    },
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`animate-pop rounded-full px-4 py-2.5 text-sm font-semibold shadow-float flex items-center gap-2 ${
            t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'success' ? 'bg-mint-deep text-white' : 'bg-ink text-paper'
          }`}
        >
          {t.tone === 'success' && <Icon name="check" size={16} stroke={3} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
