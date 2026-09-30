import type { CharacterSpriteId } from '@/store/gameStore';
import { SITE } from '@/config';

export interface CardInfo {
  /** "VICTORY!" for the winner, or "<NAME> WINS" for everyone else. */
  title: string;
  /** The dino drawn big on the card: yours. */
  spriteId: CharacterSpriteId;
  color: string;
  name: string;
  heldS: number;
  grabs: number;
  roast: string | null;
  won: boolean;
}

const W = 1200;
const H = 630;
const HEADING = '"Press Start 2P", monospace';
const BODY = '"VT323", monospace';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the results card (1200x630, the size social sites preview) and returns a PNG. */
export async function renderCard(info: CardInfo): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const base = import.meta.env.BASE_URL;

  await Promise.all([
    document.fonts?.load(`48px ${HEADING}`).catch(() => undefined),
    document.fonts?.load(`40px ${BODY}`).catch(() => undefined),
  ]);
  const [bg, sheet] = await Promise.all([
    loadImage(`${base}assets/main_bg.webp`),
    loadImage(`${base}assets/characters/dino_${info.spriteId}.png`),
  ]);

  ctx.imageSmoothingEnabled = false;

  // Background: the title art, darkened so the text reads.
  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(0, 0, W, H);
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * s) / 2, 0, bg.width * s, bg.height * s);
  }
  ctx.fillStyle = 'rgba(17,17,28,0.62)';
  ctx.fillRect(0, 0, W, H);

  // Frame.
  ctx.strokeStyle = info.won ? '#ffc93c' : '#f4e7c3';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  // The dino, big, on its colour.
  const box = 330;
  const bx = 70;
  const by = (H - box) / 2 - 10;
  ctx.fillStyle = '#11111c';
  ctx.fillRect(bx + 10, by + 10, box, box);
  ctx.fillStyle = info.color;
  ctx.fillRect(bx, by, box, box);
  ctx.strokeStyle = '#11111c';
  ctx.lineWidth = 6;
  ctx.strokeRect(bx, by, box, box);
  if (sheet) {
    const frame = 4; // first run frame
    const scale = 12;
    const size = 24 * scale;
    ctx.drawImage(sheet, frame * 24, 0, 24, 24, bx + (box - size) / 2, by + (box - size) / 2 - 8, size, size);
  }
  if (info.won) {
    // A "WINNER" ribbon across the top of the box. Drawn, not an emoji, so it looks the
    // same on devices without an emoji font.
    const rw = 250;
    const rh = 52;
    const rx = bx + (box - rw) / 2;
    const ry = by - rh / 2;
    ctx.fillStyle = '#11111c';
    ctx.fillRect(rx + 6, ry + 6, rw, rh);
    ctx.fillStyle = '#ffc93c';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#11111c';
    ctx.lineWidth = 4;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.font = `24px ${HEADING}`;
    ctx.fillStyle = '#11111c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WINNER', rx + rw / 2, ry + rh / 2 + 2);
  }

  // Text column, on its own panel so the title art's logo doesn't fight the headline.
  const tx = 460;
  const tw = W - tx - 60;
  ctx.fillStyle = 'rgba(17,17,28,0.78)';
  ctx.fillRect(tx - 30, 60, W - tx - 10, H - 120);
  ctx.strokeStyle = '#4d2813';
  ctx.lineWidth = 4;
  ctx.strokeRect(tx - 30, 60, W - tx - 10, H - 120);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.font = `${info.title.length > 10 ? 40 : 56}px ${HEADING}`;
  ctx.fillStyle = '#11111c';
  ctx.fillText(info.title, tx + 5, 105, tw);
  ctx.fillStyle = info.won ? '#ffc93c' : '#e8503a';
  ctx.fillText(info.title, tx, 100, tw);

  ctx.font = `22px ${HEADING}`;
  ctx.fillStyle = '#f4e7c3';
  ctx.fillText(info.won ? `${info.name} held the egg at the buzzer` : `I played as ${info.name}`, tx, 190, tw);

  ctx.font = `52px ${BODY}`;
  ctx.fillStyle = '#ffc93c';
  ctx.fillText(`HELD ${info.heldS}s  ·  ${info.grabs} GRAB${info.grabs === 1 ? '' : 'S'}`, tx, 250, tw);

  if (info.roast) {
    ctx.font = `40px ${BODY}`;
    ctx.fillStyle = '#f4e7c3';
    wrap(ctx, `“${info.roast}”`, tw).slice(0, 3).forEach((l, i) => ctx.fillText(l, tx, 330 + i * 42));
  }

  // Footer.
  ctx.font = `20px ${HEADING}`;
  ctx.fillStyle = '#ffc93c';
  ctx.fillText(SITE.name.toUpperCase(), tx, H - 110);
  ctx.font = `38px ${BODY}`;
  ctx.fillStyle = '#f4e7c3';
  ctx.fillText(`Play free at ${SITE.url.replace(/^https?:\/\//, '')}`, tx, H - 78, tw);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the card'))), 'image/png'),
  );
}

/**
 * Share the card through the system share sheet where the browser can share files
 * (phones), otherwise download it. Resolves to what happened.
 */
export async function shareCard(info: CardInfo): Promise<'shared' | 'saved' | 'cancelled'> {
  const blob = await renderCard(info);
  const file = new File([blob], 'chase-dinosaurs.png', { type: 'image/png' });
  const text = info.won
    ? `I won at ${SITE.name}! Held the golden egg at the buzzer. ${SITE.url}`
    : `${info.title} at ${SITE.name}. Your turn: ${SITE.url}`;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return 'cancelled';
    // Share failed for another reason: fall through to a download.
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chase-dinosaurs.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'saved';
}
