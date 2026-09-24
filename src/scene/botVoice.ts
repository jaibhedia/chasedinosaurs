/**
 * What the bots say when there's no LLM to ask (offline, no key, slow answer).
 * `{t}` is replaced with the other dino's name.
 */
import type { AgentPersona } from '@/store/gameStore';

export type VoiceEvent = 'grab' | 'steal' | 'lost' | 'close' | 'final';

const LINES: Record<AgentPersona, Record<VoiceEvent, string[]>> = {
  aggressive: {
    grab: ['Mine. Come and take it.', 'Egg secured. Who wants some?', 'Finders keepers!'],
    steal: ['Hand it over, {t}!', 'Too slow, {t}!', 'That egg was never yours, {t}.'],
    lost: ["You'll pay for that, {t}!", 'Oh, now it is ON.', 'Enjoy it while it lasts, {t}.'],
    close: ["I'm right behind you, {t}!", 'Run faster, {t}!', 'Nowhere to hide, {t}.'],
    final: ['Ten seconds. Everybody move!', 'Last chance! Charge!', 'Finish line! GO GO GO!'],
  },
  sneaky: {
    grab: ['Nobody saw that, right?', 'Shh. Egg acquired.', 'Quietly taking this.'],
    steal: ['Psst, {t}. Check your hands.', 'Oops. Was that yours, {t}?', 'Slipped right out, {t}.'],
    lost: ['Clever, {t}. Very clever.', 'I let you have that one.', "Watch your back, {t}."],
    close: ['Look behind you, {t}...', 'You hear footsteps, {t}?', 'Closer than you think.'],
    final: ['Ten seconds. Time to vanish.', 'Now you see me...', 'Almost time. Stay sneaky.'],
  },
  cocky: {
    grab: ['Too easy.', 'Did anyone even try?', 'Born to hold eggs.'],
    steal: ['Thanks for keeping it warm, {t}!', 'Nice try, {t}. Not really.', 'Is that all, {t}?'],
    lost: ["Lucky grab, {t}.", 'I was going easy on you.', "It'll be back, {t}. It always comes back."],
    close: ['Tag, almost. Ha!', 'You call that running, {t}?', 'I could do this with my eyes shut.'],
    final: ['Ten seconds? Plenty.', 'Somebody get my trophy ready.', 'Watch and learn, everyone.'],
  },
  cautious: {
    grab: ['Okay. Okay. I have it.', 'Got it. Nobody panic.', 'Careful... careful...'],
    steal: ['Sorry, {t}! Had to.', 'Excuse me, {t}, that one is mine.', 'Gently does it. Thanks, {t}.'],
    lost: ["That's fair, {t}.", 'Oh no. Oh no no no.', 'Deep breaths. Get it back.'],
    close: ['Almost... there...', 'Easy now, {t}...', 'Just a little closer.'],
    final: ['Ten seconds! Stay calm!', "Don't panic. Don't panic.", 'Almost over, almost over.'],
  },
};

export function cannedLine(persona: AgentPersona | undefined, event: VoiceEvent, target?: string): string {
  const pool = LINES[persona ?? 'cocky'][event];
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line.replace('{t}', target ?? 'you');
}

export interface MatchRow { name: string; you: boolean; isBot: boolean; grabs: number; heldS: number }

/** A results-screen verdict from the numbers, when there's no LLM to write one. */
export function cannedRoast(rows: MatchRow[], winnerName: string | null): string {
  const you = rows.find((r) => r.you);
  if (!you) return winnerName ? `${winnerName} takes it.` : 'Nobody touched the egg. Bold.';
  const top = [...rows].sort((a, b) => b.heldS - a.heldS)[0];
  if (winnerName === you.name && you.heldS <= 5) return `Held it for ${you.heldS}s and still won. Timing is everything.`;
  if (winnerName === you.name) return `${you.heldS}s with the egg and the last word. Clean.`;
  if (you.grabs === 0) return 'Zero grabs. The egg barely knew you were there.';
  if (top && top.name === you.name) return `Held it longest (${you.heldS}s), lost it at the worst moment.`;
  if (you.grabs >= 3) return `${you.grabs} grabs, no win. Busy, not lucky.`;
  return `${you.heldS}s with the egg. ${winnerName ?? 'Nobody'} had better timing.`;
}
