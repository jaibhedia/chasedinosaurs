/** Room codes are 6 characters from this alphabet (no I, O, 0 or 1). See server genRoomCode. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{6}$`);
const LEN = 6;

/** The shareable link that drops a friend straight into the room. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/**
 * Pull a room code out of whatever was typed or pasted: just the code, an invite link,
 * or a whole shared message ("Room code: ABC123 https://…/join/ABC123"). Typing a code
 * stays as typed (uppercased, up to 6 characters).
 */
export function extractRoomCode(raw: string): string {
  const text = raw.toUpperCase();
  const fromLink = text.match(/\/JOIN\/([A-Z0-9]{6})(?![A-Z0-9])/);
  if (fromLink) return fromLink[1];
  const plain = text.replace(/[^A-Z0-9]/g, '');
  if (plain.length <= LEN) return plain;
  // A longer paste: the code is the last 6-character word that could be one.
  const words = text.split(/[^A-Z0-9]+/).filter((w) => CODE_RE.test(w));
  if (words.length > 0) return words[words.length - 1];
  return plain.slice(0, LEN);
}
