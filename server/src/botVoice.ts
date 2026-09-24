/**
 * The bots' voice: one short line of banter when something happens, and a one-line
 * roast on the results screen.
 *
 * This used to be the bots' whole "brain": an LLM call every 5 seconds per match that
 * picked each bot's tactic and taunt. Tactics are now decided on the client every few
 * hundred milliseconds (src/scene/botTactics.ts), so the LLM only does what it's uniquely
 * good at, talking, and only when there's something to talk about: a ~30-token line per
 * call instead of an up-to-800-token JSON plan, and lines that land on the moment
 * instead of on a timer.
 *
 * Every function returns null on any failure; the client then uses its own canned lines,
 * so bots never go silent and a provider outage costs nothing.
 */
import { getAiClient, AI_MODEL } from './ai/provider';

export type Persona = 'aggressive' | 'sneaky' | 'cocky' | 'cautious';
export type VoiceEvent = 'grab' | 'steal' | 'lost' | 'close' | 'final';

const PERSONAS: Persona[] = ['aggressive', 'sneaky', 'cocky', 'cautious'];
const EVENTS: VoiceEvent[] = ['grab', 'steal', 'lost', 'close', 'final'];
const TIMEOUT_MS = 1100;
const MAX_LINE = 80;

// After a 429 or a 402 we stop calling for a while instead of hammering the provider.
const RATE_LIMIT_BACKOFF_MS = 20_000;
const BALANCE_BACKOFF_MS = 300_000;
let backoffUntil = 0;

const EVENT_TEXT: Record<VoiceEvent, string> = {
  grab: 'you just picked up the egg off the ground',
  steal: 'you just stole the egg from {target}',
  lost: '{target} just stole the egg from you',
  close: 'you are right behind {target}, who has the egg',
  final: 'ten seconds left in the round',
};

const SYSTEM = `You write one line of playful trash talk for a cartoon dinosaur in "Chase Dinosaurs", a 60-second game where everyone fights over one golden egg and whoever holds it at the buzzer wins.
Reply with the line only: at most 10 words, no quotes, no emoji, no hashtags. Keep it family-friendly and about the game. Never mention real people, real-world traits, or anything outside the match.`;

function clean(text: string | null | undefined): string | null {
  if (!text) return null;
  const line = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/^["'“”\s]+|["'“”\s]+$/g, '')
    .trim()
    .slice(0, MAX_LINE);
  return line.length > 0 ? line : null;
}

async function complete(system: string, user: string, maxTokens: number): Promise<string | null> {
  const llm = getAiClient();
  if (!llm || Date.now() < backoffUntil) return null;
  try {
    const res = await llm.chat.completions.create(
      {
        model: AI_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 1.0,
        max_tokens: maxTokens,
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 },
    );
    return clean(res.choices?.[0]?.message?.content);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const msg = (err as Error).message || '';
    if (status === 402 || /insufficient balance/i.test(msg)) {
      backoffUntil = Date.now() + BALANCE_BACKOFF_MS;
      console.warn('[ai] provider balance exhausted — bots on canned lines for 5 min.');
    } else if (status === 429 || /rate limit/i.test(msg)) {
      backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      console.warn('[ai] rate limited — bots on canned lines for 20s.');
    }
    return null;
  }
}

export interface LineRequest {
  persona: unknown;
  event: unknown;
  name: unknown;
  target?: unknown;
  secondsLeft?: unknown;
  holding?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** One in-character line for a bot, or null. */
export async function botLine(req: LineRequest): Promise<string | null> {
  const persona = PERSONAS.includes(req.persona as Persona) ? (req.persona as Persona) : 'cocky';
  const event = EVENTS.includes(req.event as VoiceEvent) ? (req.event as VoiceEvent) : null;
  if (!event) return null;
  const name = str(req.name, 16) || 'Dino';
  const target = str(req.target, 16) || 'them';
  const seconds = typeof req.secondsLeft === 'number' ? Math.max(0, Math.round(req.secondsLeft)) : null;
  const situation = EVENT_TEXT[event].replace('{target}', target);
  const user =
    `You are ${name}, a ${persona} dinosaur. Right now: ${situation}.` +
    (seconds !== null ? ` ${seconds} seconds left.` : '') +
    (req.holding === true ? ' You are holding the egg.' : '');
  return complete(SYSTEM, user, 30);
}

export interface RoastStat { name: unknown; isBot?: unknown; grabs?: unknown; heldS?: unknown; you?: unknown }

/** One line summing up the match for the results screen, or null. */
export async function matchRoast(stats: RoastStat[], winner: unknown): Promise<string | null> {
  if (!Array.isArray(stats) || stats.length === 0) return null;
  const rows = stats.slice(0, 4).map((s) => ({
    name: str(s.name, 16),
    bot: s.isBot === true,
    you: s.you === true,
    grabs: typeof s.grabs === 'number' ? s.grabs : 0,
    secondsHeld: typeof s.heldS === 'number' ? Math.round(s.heldS) : 0,
  }));
  const system = `You write the one-line verdict shown after a match of "Chase Dinosaurs", a 60-second game where dinosaurs fight over one golden egg and whoever holds it at the buzzer wins.
Tease the player marked "you" in a friendly way, based only on the numbers given. At most 14 words, no quotes, no emoji. Family-friendly.`;
  const user = `Winner: ${str(winner, 16) || 'nobody'}. Players: ${JSON.stringify(rows)}`;
  return complete(system, user, 40);
}
