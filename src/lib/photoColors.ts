// Picks two toy colors from a photo, entirely on the device.
// The image is drawn to a tiny canvas, read, and discarded — never uploaded.
import { COLORS, type ColorId } from '../../shared/content.ts';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PALETTE = COLORS.map((c) => ({ id: c.id, rgb: rgb(c.hex) }));

export async function colorsFromPhoto(file: File): Promise<{ color: ColorId; accent: ColorId }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read that image'));
      i.src = url;
    });
    const size = 48;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    // centre-crop
    const s = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    const data = g.getImageData(0, 0, size, size).data;

    const score = new Map<ColorId, number>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, gr, b] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(r, gr, b);
      const min = Math.min(r, gr, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      let best = PALETTE[0];
      let bestD = Infinity;
      for (const p of PALETTE) {
        const d = (p.rgb[0] - r) ** 2 + (p.rgb[1] - gr) ** 2 + (p.rgb[2] - b) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      // Favour colourful pixels so clothing and backgrounds beat grey walls.
      score.set(best.id, (score.get(best.id) ?? 0) + 0.25 + sat);
    }
    const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const color = ranked[0] ?? 'coral';
    const accent = ranked.find((id) => id !== color) ?? 'cloud';
    return { color, accent };
  } finally {
    URL.revokeObjectURL(url);
  }
}
