import { create } from 'zustand';

export type GameMode = 'single-player' | 'multiplayer';
/** Solo bot strength. Multiplayer fill-bots always play on 'normal'. */
export type Difficulty = 'easy' | 'normal' | 'hard';
/** Which side of a phone screen the joystick sits on; the power button takes the other. */
export type StickSide = 'left' | 'right';
export type GamePhase = 'countdown' | 'playing' | 'ended';
export type PowerUpType = 'speed-boost' | 'earthquake' | 'shield' | 'teleport';

export interface PowerUp {
  name: string;
  description: string;
  duration: number;
  cooldown: number;
  type: PowerUpType;
}

export type CharacterSpriteId = 'doux' | 'mort' | 'tard' | 'vita';

export interface Character {
  id: string;
  name: string;
  speed: number;
  color: string;
  image?: string;
  spriteId: CharacterSpriteId;
  powerUp: PowerUp;
}

export interface GameMap {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
}

/** Agent-brain intent (mirrors server/src/agents/agentBrain.ts). */
export type AgentMode = 'hunt' | 'flee' | 'guard' | 'intercept' | 'roam';
export type AgentPersona = 'aggressive' | 'sneaky' | 'cocky' | 'cautious';
export interface AgentIntent {
  agentId: string;
  mode: AgentMode;
  targetId?: string;
  persona?: AgentPersona;
  taunt?: string;
}

/** One blip on the minimap. Fed from the scene at ~12Hz (throttled). */
export interface MinimapDot {
  x: number;
  y: number;
  color: string;
  kind: 'self' | 'agent' | 'human' | 'egg';
}

export interface Player {
  id: string;
  x: number;
  y: number;
  character: Character;
  isBot: boolean;
  hasEgg: boolean;
  eggHoldCount: number;
  /** Total time this player has held the egg this match (ms). */
  eggHeldMs?: number;
  /** Times this player took the egg from another player this match (5 points each). */
  steals?: number;
  userId?: string;
  targetX?: number;
  targetY?: number;
  /** High-level intent for a bot; executed each frame by updateBots(). */
  aiIntent?: AgentIntent;
  persona?: AgentPersona;
  /** Latest taunt + when it arrived (ms), for the timed speech bubble. */
  taunt?: string;
  tauntAt?: number;
  powerUpReady?: boolean;
  powerUpActive?: boolean;
  powerUpCooldown?: number;
  /** Remaining active-effect time (ms), counted down by the dt-based update loop
   *  (NOT setTimeout) so it never gets stuck on pause or background-tab throttling. */
  powerUpActiveMs?: number;
  /** The cooldown value (ms) at the moment of activation — lets the HUD draw an
   *  accurate reload ring even though the reload time shortens late-game. */
  powerUpCooldownMax?: number;
  isInvincible?: boolean;
  slowedUntil?: number;
  speedBoostActive?: boolean;
  trail?: Array<{ x: number; y: number; alpha: number }>;
}

/** One row of the live in-match leaderboard, published by the scene a few times a second. */
export interface ScoreRow {
  id: string;
  name: string;
  points: number;
  heldS: number;
  steals: number;
  hasEgg: boolean;
  isSelf: boolean;
}

export interface GameObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'furniture' | 'wall' | 'hiding-spot';
  color: string;
  propType?: string;
  isPushable?: boolean;
  vx?: number;
  vy?: number;
  mass?: number;
}

const USER_ID_STORAGE_KEY = 'chaseUserId';
const DIFFICULTY_STORAGE_KEY = 'chase-difficulty';
const STICK_SIDE_STORAGE_KEY = 'chase-stick-side';

function readDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    if (v === 'easy' || v === 'normal' || v === 'hard') return v;
  } catch { /* storage blocked */ }
  return 'normal';
}

function readStickSide(): StickSide {
  try {
    if (localStorage.getItem(STICK_SIDE_STORAGE_KEY) === 'left') return 'left';
  } catch { /* storage blocked */ }
  return 'right';
}

function generateGuestId(): string {
  const rand = Math.random().toString(36).slice(2, 11);
  return `guest_${rand}`;
}

interface GameState {
  userId: string | null;
  gameMode: GameMode | null;
  selectedCharacter: Character | null;
  selectedMap: GameMap | null;
  difficulty: Difficulty;
  stickSide: StickSide;
  gamePhase: GamePhase;
  players: Player[];
  gameObjects: GameObject[];
  timeRemaining: number;
  countdownTimer: number;
  eggOwnerId: string | null;
  eggPosition: { x: number; y: number } | null;
  lastEggHolderId: string | null;
  winner: Player | null;
  gameMessage: string;
  serverStartTime: number | null;
  roomPlayers: any[];
  roomCode: string | null;
  /** The current room came from Quick Play (results then offers another quick match). */
  quickPlay: boolean;
  multiplayerHiddenFill: boolean;
  /** In-game menu open → freeze the simulation. */
  paused: boolean;
  /** Throttled snapshot of world positions for the minimap (world dims + blips). */
  minimap: { w: number; h: number; dots: MinimapDot[] };
  /** Live in-match leaderboard rows (unsorted). */
  scoreboard: ScoreRow[];
  /** Admin spectator: watching roomCode's matches without a seat (see /admin). */
  spectating: boolean;
  /** Spectator camera: the player id to follow, or null to follow the egg. */
  spectateFollow: string | null;

  setUserId: (id: string | null) => void;
  initUserId: () => string;
  setGameMode: (mode: GameMode) => void;
  setCharacter: (character: Character) => void;
  setMap: (map: GameMap) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setStickSide: (side: StickSide) => void;
  setGamePhase: (phase: GamePhase) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  setGameObjects: (objects: GameObject[]) => void;
  setTimeRemaining: (time: number) => void;
  setCountdownTimer: (time: number) => void;
  setGameResult: (winner: Player | null, message: string) => void;
  setServerStartTime: (time: number | null) => void;
  setRoomPlayers: (players: any[]) => void;
  setRoomCode: (code: string | null) => void;
  setQuickPlay: (value: boolean) => void;
  setMultiplayerHiddenFill: (value: boolean) => void;
  setPaused: (value: boolean) => void;
  setMinimap: (minimap: { w: number; h: number; dots: MinimapDot[] }) => void;
  setScoreboard: (rows: ScoreRow[]) => void;
  setSpectating: (value: boolean) => void;
  setSpectateFollow: (id: string | null) => void;
  setEgg: (ownerId: string | null, position: { x: number; y: number } | null) => void;
  setLastEggHolderId: (id: string | null) => void;
  /** Clear everything about the last match, keeping who you are and what you picked. */
  resetMatch: () => void;
  resetGame: () => void;
}

const initialState = {
  userId: null,
  gameMode: null,
  selectedCharacter: null,
  selectedMap: null,
  gamePhase: 'countdown' as GamePhase,
  players: [],
  gameObjects: [],
  timeRemaining: 120,
  countdownTimer: 3,
  eggOwnerId: null as string | null,
  eggPosition: null as { x: number; y: number } | null,
  lastEggHolderId: null as string | null,
  winner: null,
  gameMessage: '',
  serverStartTime: null,
  roomPlayers: [],
  roomCode: null,
  quickPlay: false,
  multiplayerHiddenFill: false,
  paused: false,
  minimap: { w: 0, h: 0, dots: [] as MinimapDot[] },
  scoreboard: [] as ScoreRow[],
  spectating: false,
  spectateFollow: null as string | null,
};

/** Per-match fields: cleared between matches, unlike identity and menu choices. */
const matchState = {
  gamePhase: 'countdown' as GamePhase,
  players: [] as Player[],
  gameObjects: [] as GameObject[],
  timeRemaining: 120,
  countdownTimer: 3,
  eggOwnerId: null as string | null,
  eggPosition: null as { x: number; y: number } | null,
  lastEggHolderId: null as string | null,
  winner: null as Player | null,
  gameMessage: '',
  paused: false,
  minimap: { w: 0, h: 0, dots: [] as MinimapDot[] },
  scoreboard: [] as ScoreRow[],
  spectateFollow: null as string | null,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,
  difficulty: readDifficulty(),
  stickSide: readStickSide(),

  setUserId: (id) => set({ userId: id }),
  initUserId: () => {
    const existing = get().userId;
    if (existing) return existing;
    if (typeof window === 'undefined') return '';
    let id = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (!id) {
      id = generateGuestId();
      window.localStorage.setItem(USER_ID_STORAGE_KEY, id);
    }
    set({ userId: id });
    return id;
  },
  setGameMode: (mode) => set({ gameMode: mode }),
  setCharacter: (character) => set({ selectedCharacter: character }),
  setMap: (map) => set({ selectedMap: map }),
  setDifficulty: (difficulty) => {
    try { localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty); } catch { /* storage blocked */ }
    set({ difficulty });
  },
  setStickSide: (side) => {
    try { localStorage.setItem(STICK_SIDE_STORAGE_KEY, side); } catch { /* storage blocked */ }
    set({ stickSide: side });
  },
  setGamePhase: (phase) => set({ gamePhase: phase }),
  setPlayers: (players) => set({ players }),
  updatePlayer: (id, updates) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  setGameObjects: (objects) => set({ gameObjects: objects }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setCountdownTimer: (time) => set({ countdownTimer: time }),
  setGameResult: (winner, message) =>
    set({ winner, gameMessage: message, gamePhase: 'ended' }),
  setServerStartTime: (time) => set({ serverStartTime: time }),
  setRoomPlayers: (players) => set({ roomPlayers: players }),
  setRoomCode: (code) => set({ roomCode: code }),
  setQuickPlay: (value) => set({ quickPlay: value }),
  setMultiplayerHiddenFill: (value) => set({ multiplayerHiddenFill: value }),
  setPaused: (value) => set({ paused: value }),
  setMinimap: (minimap) => set({ minimap }),
  setScoreboard: (scoreboard) => set({ scoreboard }),
  setSpectating: (value) => set({ spectating: value }),
  setSpectateFollow: (id) => set({ spectateFollow: id }),
  setEgg: (ownerId, position) => set({ eggOwnerId: ownerId, eggPosition: position }),
  setLastEggHolderId: (id) => set({ lastEggHolderId: id }),
  resetMatch: () => set({ ...matchState }),
  resetGame: () => set({ ...initialState, userId: get().userId, difficulty: get().difficulty }),
}));
