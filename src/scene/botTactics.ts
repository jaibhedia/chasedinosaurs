/**
 * Bot tactics: who does what, decided locally every few hundred milliseconds.
 *
 * This used to come from the LLM on a 5-second tick, which meant every offline match,
 * and the first five seconds of every online one, ran on a leaderless fallback where all
 * three bots dogpiled the egg. The division of labour is simple enough to state as a
 * rule, so it's a rule: the nearest chaser goes straight in, the next one cuts off the
 * escape, and any third one covers the lane the holder is running into. The LLM still
 * gives the bots their personality and trash talk.
 *
 * Pure functions only, so the tuning can be reasoned about without a running scene.
 */
import type { AgentMode, AgentPersona, Difficulty } from '@/store/gameStore';

export type Role = AgentMode; // 'hunt' | 'intercept' | 'guard' | 'flee' | 'roam'

export interface BotTuning {
  /** Speed multiplier at the start and end of the round (bots warm up as the clock runs). */
  speed: [number, number];
  /** How far ahead of a moving target they aim, 0 = at it, 1 = full intercept. */
  lead: [number, number];
  /** How often a bot re-reads the situation and re-aims. Slower reads as clumsier. */
  reactionMs: number;
  /** Whether bots split roles. Without it, all of them chase the holder directly. */
  teamwork: boolean;
  /** Power-up use: rare random presses, random presses, or used when it actually helps. */
  powers: 'rare' | 'random' | 'smart';
}

export const TUNING: Record<Difficulty, BotTuning> = {
  easy: { speed: [0.8, 0.9], lead: [0.1, 0.35], reactionMs: 650, teamwork: false, powers: 'rare' },
  normal: { speed: [0.86, 1.0], lead: [0.3, 0.8], reactionMs: 320, teamwork: true, powers: 'random' },
  hard: { speed: [0.96, 1.05], lead: [0.7, 1.0], reactionMs: 140, teamwork: true, powers: 'smart' },
};

/** Stable persona per bot slot, so each bot has a consistent feel even with no LLM. */
export const PERSONAS: AgentPersona[] = ['aggressive', 'sneaky', 'cocky', 'cautious'];

/** A small nudge on top of difficulty, so the personas read differently in motion. */
export const PERSONA_SPEED: Record<AgentPersona, number> = {
  aggressive: 1.05,
  cocky: 1.02,
  sneaky: 1.0,
  cautious: 0.96,
};

export interface Pos { id: string; x: number; y: number }

export interface TacticalView {
  bots: Pos[];
  /** Whoever carries the egg, or null when it's on the ground. */
  holder: (Pos & { isBot: boolean }) | null;
  egg: { x: number; y: number } | null;
}

/**
 * Assign each bot a role. Everyone is an opponent: bots chase a bot holder exactly as
 * they chase a human one.
 */
export function assignRoles(view: TacticalView, teamwork: boolean): Map<string, Role> {
  const roles = new Map<string, Role>();
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  if (view.holder) {
    const holder = view.holder;
    const chasers = view.bots.filter((b) => b.id !== holder.id).sort((a, b) => dist(a, holder) - dist(b, holder));
    if (view.bots.some((b) => b.id === holder.id)) roles.set(holder.id, 'flee');
    chasers.forEach((b, i) => {
      if (!teamwork) roles.set(b.id, 'hunt');
      else roles.set(b.id, i === 0 ? 'hunt' : i === 1 ? 'intercept' : 'guard');
    });
    return roles;
  }

  if (view.egg) {
    const egg = view.egg;
    const byEgg = [...view.bots].sort((a, b) => dist(a, egg) - dist(b, egg));
    byEgg.forEach((b, i) => roles.set(b.id, !teamwork || i === 0 ? 'hunt' : 'guard'));
    return roles;
  }

  view.bots.forEach((b) => roles.set(b.id, 'roam'));
  return roles;
}

/** Linear ramp across the round: 0 at the whistle, 1 at the buzzer. */
export function ramp([from, to]: [number, number], progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return from + (to - from) * p;
}
