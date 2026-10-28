import { ACCESSORIES, BODIES, COLORS, type Avatar } from '../../shared/content.ts';

export function randomAvatar(): Avatar {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  const color = pick(COLORS.filter((c) => c.id !== 'ink' && c.id !== 'cloud')).id;
  let accent = pick(COLORS).id;
  if (accent === color) accent = 'cloud';
  return { body: pick(BODIES).id, color, accent, accessory: pick(ACCESSORIES.slice(1)).id };
}
