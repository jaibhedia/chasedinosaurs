/**
 * Server-side match state: who holds the egg, the clock, and the result.
 *
 * Clients used to decide egg ownership themselves: whoever's screen showed contact
 * broadcast "I have it now", and every other client kept whichever message arrived last.
 * Two players touching the holder in the same instant both won, and screens disagreed
 * about who had the egg and, at the buzzer, who won. Now clients only *claim*; this
 * module accepts or rejects each claim against positions the server has seen, orders the
 * accepted ones with a sequence number, and ends the match on its own clock.
 *
 * Positions are still client-reported, so this is consistency, not anti-cheat: a claim
 * is checked against where the server last heard both players were, with slack for
 * latency. See ROADMAP.md (M5) for moving the simulation itself server-side.
 */

/** Must match GAME_DURATION in src/scene/gameShared.ts. */
export const MATCH_SECONDS = 60;
export const COUNTDOWN_MS = 3000;
/** Client tag reach: max(TAG_DISTANCE, PLAYER_SIZE * 2.2) in gameShared.ts. */
const TAG_REACH = 55;
/**
 * Extra reach allowed for latency. Two players' last reports can each be a packet
 * (~33ms) old, at up to ~600px/s with a speed boost, plus network jitter.
 */
const LATENCY_SLACK = 65;
/** A fresh holder can't be robbed for this long (matches EGG_GRACE_MS). */
const GRACE_MS = 1800;
/** Minimum gap between two handoffs (matches TAG_COOLDOWN). */
const COOLDOWN_MS = 1200;
/** Positions older than this don't count as evidence of contact. */
const STALE_MS = 1500;

export interface Pos { x: number; y: number; t: number; invincible: boolean }

export interface EggOwner {
  ownerUserId: string | null;
  prevOwnerUserId: string | null;
  seq: number;
  /** Server time until which the new holder can't be robbed. */
  graceUntil: number;
}

export interface MatchResult {
  winnerUserId: string | null;
  stats: Array<{ userId: string; grabs: number; heldMs: number }>;
}

export class Match {
  readonly startAt: number;
  readonly playAt: number;
  readonly endAt: number;
  private holder: string | null = null;
  private lastHolder: string | null = null;
  private heldSince = 0;
  private seq = 0;
  private graceUntil = 0;
  private lastTagAt = 0;
  private egg: { x: number; y: number } | null = null;
  private positions = new Map<string, Pos>();
  private grabs = new Map<string, number>();
  private heldMs = new Map<string, number>();
  ended = false;

  constructor(startAt: number) {
    this.startAt = startAt;
    this.playAt = startAt + COUNTDOWN_MS;
    this.endAt = this.playAt + MATCH_SECONDS * 1000;
  }

  report(userId: string, x: number, y: number, invincible: boolean, now = Date.now()): void {
    this.positions.set(userId, { x, y, t: now, invincible });
  }

  owner(): EggOwner {
    return { ownerUserId: this.holder, prevOwnerUserId: null, seq: this.seq, graceUntil: this.graceUntil };
  }

  /**
   * A client says `claimer` just reached the egg (on the ground, at eggX/eggY) or touched
   * its holder. Returns the new owner state if accepted, null if rejected.
   */
  claim(claimer: string, eggX: number | null, eggY: number | null, now = Date.now()): EggOwner | null {
    if (this.ended || now < this.playAt || now > this.endAt) return null;
    if (!claimer || claimer === this.holder) return null;
    const me = this.positions.get(claimer);
    if (!me || now - me.t > STALE_MS || me.invincible) return null;
    const reach = TAG_REACH + LATENCY_SLACK;

    if (this.holder === null) {
      // Every client derives the same spawn point, so the first claim tells us where it is.
      if (!this.egg && eggX !== null && eggY !== null) this.egg = { x: eggX, y: eggY };
      if (!this.egg) return null;
      if (Math.hypot(me.x - this.egg.x, me.y - this.egg.y) > reach) return null;
    } else {
      if (now < this.graceUntil || now - this.lastTagAt < COOLDOWN_MS) return null;
      const h = this.positions.get(this.holder);
      if (!h || h.invincible) return null;
      if (Math.hypot(me.x - h.x, me.y - h.y) > reach) return null;
    }

    const prev = this.holder;
    if (prev) this.heldMs.set(prev, (this.heldMs.get(prev) ?? 0) + (now - this.heldSince));
    this.holder = claimer;
    this.lastHolder = claimer;
    this.heldSince = now;
    this.grabs.set(claimer, (this.grabs.get(claimer) ?? 0) + 1);
    this.seq += 1;
    this.graceUntil = now + GRACE_MS;
    this.lastTagAt = now;
    return { ownerUserId: claimer, prevOwnerUserId: prev, seq: this.seq, graceUntil: this.graceUntil };
  }

  /** Close the match. The last holder at the buzzer wins; null if nobody ever touched it. */
  finish(now = Date.now()): MatchResult {
    this.ended = true;
    const end = Math.min(now, this.endAt);
    if (this.holder) this.heldMs.set(this.holder, (this.heldMs.get(this.holder) ?? 0) + Math.max(0, end - this.heldSince));
    const ids = new Set([...this.grabs.keys(), ...this.heldMs.keys()]);
    return {
      winnerUserId: this.holder ?? this.lastHolder,
      stats: [...ids].map((userId) => ({
        userId,
        grabs: this.grabs.get(userId) ?? 0,
        heldMs: Math.round(this.heldMs.get(userId) ?? 0),
      })),
    };
  }
}
