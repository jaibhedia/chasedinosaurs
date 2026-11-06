/**
 * Player names. Players pick their own; before this a room named everyone after their dino,
 * so the all-time board only ever showed four names. The browser applies the same rules
 * (src/lib/playerName.ts), but these are the ones that count.
 */
export const NAME_MIN = 2;
export const NAME_MAX = 16;

/**
 * Letters in any script (with their accents and vowel signs), digits, spaces and . _ -.
 * Spaces are collapsed and trimmed, and the result is at most 16 long. '' when fewer than
 * two usable characters are left.
 */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  const name = v
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N} ._-]/gu, '')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return name.length >= NAME_MIN ? name : '';
}

/** `name`, or "name 2", "name 3"… when another player in the room has it (in any case). */
export function uniqueName(name: string, others: string[]): string {
  const taken = new Set(others.map((n) => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const tag = ` ${i}`;
    const next = name.slice(0, NAME_MAX - tag.length).trimEnd() + tag;
    if (!taken.has(next.toLowerCase())) return next;
  }
}
