// Everything attendees can pick from, plus the hall layout.
// Shared by the browser and the server so both agree on what is valid.

export const BODIES = [
  { id: 'bean', label: 'Bean' },
  { id: 'bear', label: 'Bub' },
  { id: 'cat', label: 'Kit' },
  { id: 'bot', label: 'Bolt' },
  { id: 'sprout', label: 'Sprout' },
] as const;

export const COLORS = [
  { id: 'coral', label: 'Coral', hex: '#FF7A5C' },
  { id: 'tangerine', label: 'Tangerine', hex: '#FFA23A' },
  { id: 'butter', label: 'Butter', hex: '#F7D154' },
  { id: 'mint', label: 'Mint', hex: '#5FD3A5' },
  { id: 'sky', label: 'Sky', hex: '#5BB8F5' },
  { id: 'lilac', label: 'Lilac', hex: '#A88BF5' },
  { id: 'blush', label: 'Blush', hex: '#F58BB8' },
  { id: 'cloud', label: 'Cloud', hex: '#F2EEE8' },
  { id: 'ink', label: 'Ink', hex: '#3A3550' },
] as const;

export const ACCESSORIES = [
  { id: 'none', label: 'None' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'partyhat', label: 'Party hat' },
  { id: 'flower', label: 'Flower' },
  { id: 'scarf', label: 'Scarf' },
] as const;

export type BodyId = (typeof BODIES)[number]['id'];
export type ColorId = (typeof COLORS)[number]['id'];
export type AccessoryId = (typeof ACCESSORIES)[number]['id'];

export interface Avatar {
  body: BodyId;
  color: ColorId;
  accent: ColorId;
  accessory: AccessoryId;
}

export const colorHex = (id: ColorId): string =>
  COLORS.find((c) => c.id === id)?.hex ?? '#FF7A5C';

export const REACTIONS = ['👋', '😄', '🔥', '🙌', '☕', '💡', '🎉', '❤️'] as const;

export const ICEBREAKERS = [
  'What brought you here today?',
  'Best talk you’ve seen so far?',
  'What are you working on lately?',
  'Coffee or tea person?',
  'First time at this event?',
  'Love your toy! 🙌',
  'Want to grab a coffee?',
  'What should I not miss today?',
] as const;

export const MAX_SPOTS = 6;

export const DEFAULT_SPOTS = [
  { id: 's1', name: 'Coffee Corner', hint: 'By the coffee bar' },
  { id: 's2', name: 'Main Stage', hint: 'Front left of the stage' },
  { id: 's3', name: 'Registration Desk', hint: 'At the entrance' },
  { id: 's4', name: 'Lounge', hint: 'The sofas near the windows' },
];

// ---------- Hall layout (world units, y is up, floor is the x/z plane) ----------

export const HALL = { halfX: 11, halfZ: 11 } as const;

export interface Zone {
  id: 'main' | 'coffee' | 'play';
  name: string;
  x: number;
  z: number;
  radius: number;
}

export const ZONES: Zone[] = [
  { id: 'main', name: 'Main Hall', x: 0, z: 0, radius: 3.6 },
  { id: 'coffee', name: 'Coffee Corner', x: -6.5, z: -6.5, radius: 2.8 },
  { id: 'play', name: 'Play Zone', x: 6.5, z: -6.5, radius: 2.8 },
];

// Where meetup spot pins sit in the virtual hall, in the order the organizer lists them.
export const SPOT_SLOTS: { x: number; z: number }[] = [
  { x: -8.2, z: 2.2 },
  { x: -4, z: 8 },
  { x: 4, z: 8 },
  { x: 8.2, z: 2.2 },
  { x: -8.5, z: 8.5 },
  { x: 8.5, z: 8.5 },
];

export function clampToHall(x: number, z: number) {
  const m = 0.6;
  return {
    x: Math.max(-HALL.halfX + m, Math.min(HALL.halfX - m, x)),
    z: Math.max(-HALL.halfZ + m, Math.min(HALL.halfZ - m, z)),
  };
}

export function zoneAt(x: number, z: number): Zone | undefined {
  return ZONES.find((zn) => Math.hypot(zn.x - x, zn.z - z) <= zn.radius);
}

// ---------- Mini-game: "Sync Up" ----------
// Two players answer quick this-or-that questions. Matching answers fill a
// shared meter. Nobody loses — the result is a conversation starter.

export const SYNC_QUESTIONS: [string, string, string][] = [
  ['Morning person or night owl?', 'Morning', 'Night owl'],
  ['Coffee or tea?', 'Coffee', 'Tea'],
  ['Mountains or the sea?', 'Mountains', 'Sea'],
  ['Plan everything or wing it?', 'Plan it', 'Wing it'],
  ['Cats or dogs?', 'Cats', 'Dogs'],
  ['Books or podcasts?', 'Books', 'Podcasts'],
  ['Sweet or savory?', 'Sweet', 'Savory'],
  ['City break or road trip?', 'City break', 'Road trip'],
  ['Dark mode or light mode?', 'Dark', 'Light'],
  ['Front row or back row?', 'Front row', 'Back row'],
  ['Sketch it or build it?', 'Sketch it', 'Build it'],
  ['Pizza or tacos?', 'Pizza', 'Tacos'],
  ['Headphones on or off?', 'On', 'Off'],
  ['Sunrise or sunset?', 'Sunrise', 'Sunset'],
];

export const SYNC_ROUNDS = 5;
export const SYNC_ROUND_MS = 9000;
export const SYNC_REVEAL_MS = 1800;
export const SYNC_COUNTDOWN_MS = 3000;

export const INVITE_TTL_MS = 2 * 60 * 1000;
export const AWAY_GRACE_MS = 45 * 1000;
