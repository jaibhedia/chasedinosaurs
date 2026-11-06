/**
 * Player names. Each player picks one (on the mode screen, in Settings or in a room's
 * lobby) and it shows on the room roster, over their dino, on the live and all-time boards
 * and on the results screen. The server applies the same rules (server/src/names.ts) and
 * adds " 2" when someone in the room already has the name.
 */
export const NAME_MIN = 2;
export const NAME_MAX = 16;

/**
 * Letters in any script (with their accents and vowel signs), digits, spaces and . _ -.
 * Spaces are collapsed and trimmed, and the result is at most 16 long. '' when fewer than
 * two usable characters are left.
 */
export function cleanName(raw: string): string {
  const name = raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N} ._-]/gu, '')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return name.length >= NAME_MIN ? name : '';
}

/** What a new player is called until they pick a name. */
export function defaultName(): string {
  return `Dino ${Math.floor(1000 + Math.random() * 9000)}`;
}

/** A human's name from the room roster, or `fallback` (their dino's name) when it has none. */
export function rosterName(
  roster: Array<{ user_id?: string; player_name?: string }>,
  userId: string | null | undefined,
  fallback: string,
): string {
  if (!userId) return fallback;
  return roster.find((r) => r.user_id === userId)?.player_name || fallback;
}
