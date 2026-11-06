/**
 * Match scoring: a point for every second with the egg, 5 for each steal (taking it from
 * another player; the first pickup off the ground isn't one), 30 for holding it at the
 * buzzer. Must match server/src/match.ts, which scores online matches.
 */
export const POINTS_PER_SECOND = 1;
export const POINTS_PER_STEAL = 5;
export const POINTS_FOR_WIN = 30;

export function matchPoints(heldMs: number, steals: number, won: boolean): number {
  return Math.floor(heldMs / 1000) * POINTS_PER_SECOND + steals * POINTS_PER_STEAL + (won ? POINTS_FOR_WIN : 0);
}
