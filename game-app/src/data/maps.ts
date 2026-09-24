import { GameMap } from '@/store/gameStore';

/**
 * Arenas. There is one for now: every earlier "map" rendered this same grassland, so
 * offering a choice between three names was offering no choice at all. New arenas get
 * added here once they have their own art and layout.
 */
export const gameMaps: GameMap[] = [
  {
    id: 'map-1',
    name: 'Summer Plains',
    description: 'Open grassland with tree groves, bushes and long sightlines',
    width: 2200,
    height: 1200,
  },
];
