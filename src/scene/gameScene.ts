import * as Phaser from 'phaser';
import { useGameStore, Player, GameObject, AgentIntent, MinimapDot } from '@/store/gameStore';
import { characters } from '@/data/characters';
import { audioManager } from '@/utils/audioManager';
import { buzz } from '@/lib/haptics';
import { cannedLine, type VoiceEvent } from './botVoice';
import { PLAYER_SIZE, TAG_DISTANCE, TAG_COOLDOWN, GAME_DURATION, checkCollision, findCollider, findSafeSpawnPosition } from './gameShared';
import { getGameSocket, getServerOffset } from '@/lib/socketBridge';
import { TUNING, PERSONAS, PERSONA_SPEED, assignRoles, ramp, type BotTuning, type Role } from './botTactics';
import type { Difficulty } from '@/store/gameStore';

const CHAR_SPRITES: Record<string, { name: string }> = {
  doux: { name: 'doux' },
  mort: { name: 'mort' },
  tard: { name: 'tard' },
  vita: { name: 'vita' },
};

const SPRITE_SCALE = 4;
/** At most one bot line this often, and each bot at most once per BOT_VOICE_EACH_MS. */
const BOT_VOICE_GAP_MS = 3500;
const BOT_VOICE_EACH_MS = 7000;
/**
 * How long a non-authority client waits on silence before steering the bots itself.
 *
 * The authority broadcasts ~30Hz, so 1.2s is ~36 missed packets — comfortably past a
 * network hiccup and well short of a 60s match, where a frozen opponent for even five
 * seconds is the whole round.
 */
const AGENT_TAKEOVER_MS = 1200;
/** Extra wait per rank, so the room fails over in order instead of all at once. */
const AGENT_TAKEOVER_STAGGER_MS = 1200;
/** How long an overhead taunt bubble stays up after it arrives. */
const TAUNT_TTL_MS = 4000;
/** First power-up unlocks 15s into the match (matches the base reload cadence). */
const POWER_UP_UNLOCK_TIME_MS = 15000;
/** Bot move speed = character.speed * mult * dt (human baseline uses 120 px/s). */
/** Bot speed when carrying the egg — close to hunters so a holder can actually flee + juke. */
const BOT_SPEED_HOLDER = 110;
/** Bot speed when chasing the egg-holder (slightly faster than the holder, so they can close gaps). */
const BOT_SPEED_HUNTER = 118;
const CHASE_FLEE_RADIUS = 380;
const CHASE_FLEE_PUSH = 2.6;
/** Same-frame retake protection: after an egg transfer, the previous holder can't yank it back inside this window. */
const TAG_BACK_BLOCK_MS = 1000;
/** Slight speed penalty for the egg-holder so they can be caught without relying completely on power-ups. */
const EGG_HOLDER_SPEED_MULT = 0.95;
/** After grabbing/stealing the egg, the new holder is steal-proof for this long (keep-away grace). */
const EGG_GRACE_MS = 1800;
const TECH_ROOM_BG_KEY = 'tech_room_bg';
const TECH_TILE_SIZE = 32;
// Pixel-art source tiles are 16px; we render the world at 2x so each tile occupies a
// 32px world cell (TECH_TILE_SIZE), keeping collision / spawn / camera maths simple.
const SRC_TILE = 16;     // tile size in the source sheets
const WORLD_SCALE = 2;   // 16px art → 32px world cell
// ── FreeEnviro grassland pack (16px sheet). One spritesheet provides BOTH the grass
// ground tile (a tilemap frame) and the tree/bush/dirt art (named sub-rect frames).
const TS_ENVIRO = 'ts_enviro';
const GRASS_SRC_X = 80;       // grass fill cell on the sheet (col5,row1)
const GRASS_SRC_Y = 16;
const GRASS_FILL_KEY = 'grass_fill'; // standalone 16px grass texture for seamless tiling
// Multiplayer uses FIXED map dimensions (not screen-derived) so every client in a
// room builds an IDENTICAL forest — same bounds, same obstacle layout — instead of
// each player seeing a differently-sized map and a different random layout.
// Arena is 25% smaller on each axis than the original 240×160 so players cross paths
// faster and the egg changes hands more often.
const MP_MAP_COLS = 180;
const MP_MAP_ROWS = 120;
const SUMMER_SCENE_KEYS = [
  'summer_scene_1',
  'summer_scene_2',
  'summer_scene_3',
] as const;
const INFERNO_BG_1_KEY = 'inferno_bg_1';
const INFERNO_BG_2_KEY = 'inferno_bg_2';
const DUNGEON_DETAIL_TILE_KEY = 'dungeon_detail_tile';
const MAX_SIM_DELTA = 1 / 30;
const POWER_COLOR: Record<string, number> = {
  'speed-boost': 0x38bdf8,
  earthquake: 0xf97316,
  shield: 0x22c55e,
  teleport: 0xa78bfa,
};
const LOCAL_PLAYER_SPRITE_FOLLOW = 1;
/** Minimum time a dino keeps facing one way after turning. */
const FACING_HOLD_MS = 180;
const REMOTE_PLAYER_SPRITE_FOLLOW = 0.4;
/** Cap (ms) on how far a remote player is dead-reckoned past its last packet, so a
 *  player who suddenly stops barely drifts. ~3 packets at the 30Hz send rate. */
const REMOTE_EXTRAPOLATE_MS = 110;
const CAMERA_FOLLOW_LERP_X = 0.24;
const CAMERA_FOLLOW_LERP_Y = 0.24;
const CAMERA_MAX_LEAD_X = 40;
const CAMERA_MAX_LEAD_Y = 30;
/** Gentle follow zoom — keeps the player framed without hiding the arena. */
const CAMERA_ZOOM = 1.3;
/**
 * Map props. Each is a real sub-rect (source px) of a sheet, drawn as one image at
 * `scale` (default WORLD_SCALE), anchored to the art's bottom-centre — so tall art
 * (tree canopies) overhangs upward while only the base footprint blocks movement.
 */
interface PropFrame { tex: string; sx: number; sy: number; sw: number; sh: number; cw: number; ch: number; scale?: number; }
const PROP_FRAMES: Record<string, PropFrame> = {
  // ── FreeEnviro grassland props (sheet TS_ENVIRO). Rects = tight alpha bounding
  // boxes measured from the sheet. Trees/bushes block only at their base; the
  // plateau is a raised mound landmark. `scale` overrides WORLD_SCALE so canopies
  // read at reference proportions. Dirt patches + grass tufts are decals (drawn
  // directly by buildGrassland, never collide) — cw/ch unused for those.
  tree_a:     { tex: TS_ENVIRO, sx: 15,  sy: 94,  sw: 17, sh: 34, cw: 16, ch: 10, scale: 2.0 },
  tree_b:     { tex: TS_ENVIRO, sx: 48,  sy: 94,  sw: 16, sh: 34, cw: 16, ch: 10, scale: 2.0 },
  tree_c:     { tex: TS_ENVIRO, sx: 80,  sy: 94,  sw: 16, sh: 34, cw: 16, ch: 10, scale: 2.0 },
  bush_md:    { tex: TS_ENVIRO, sx: 128, sy: 32,  sw: 48, sh: 48, cw: 50, ch: 30, scale: 1.5 },
  bush_dk:    { tex: TS_ENVIRO, sx: 192, sy: 32,  sw: 48, sh: 48, cw: 50, ch: 30, scale: 1.5 },
  plateau:    { tex: TS_ENVIRO, sx: 16,  sy: 16,  sw: 48, sh: 64, cw: 80, ch: 48, scale: 1.6 },
  dirt_big:   { tex: TS_ENVIRO, sx: 4,   sy: 196, sw: 55, sh: 41, cw: 0,  ch: 0 },
  dirt_long:  { tex: TS_ENVIRO, sx: 13,  sy: 261, sw: 96, sh: 36, cw: 0,  ch: 0 },
  dirt_small: { tex: TS_ENVIRO, sx: 150, sy: 278, sw: 19, sh: 17, cw: 0,  ch: 0 },
  clover:     { tex: TS_ENVIRO, sx: 155, sy: 200, sw: 66, sh: 47, cw: 0,  ch: 0 },
  tuft_a:     { tex: TS_ENVIRO, sx: 83,  sy: 165, sw: 25, sh: 12, cw: 0,  ch: 0 },
  tuft_b:     { tex: TS_ENVIRO, sx: 208, sy: 118, sw: 16, sh: 9,  cw: 0,  ch: 0 },
};

export class GameScene extends Phaser.Scene {
  private mapWidth = 1600;
  private mapHeight = 1000;
  private mapId = 'map-1';
  private gameMode = 'single-player';
  private serverStartTime: number | null = null;
  /** Shared room code (multiplayer) — seeds the map so all clients build the same forest. */
  private roomCode: string | null = null;
  /** Online-multiplayer netcode state. */
  private localUserId?: string;
  private isOnlineMp = false;
  private netBound = false;
  private lastNetSend = 0;
  /** Last position/flags actually broadcast, so idle frames can be skipped instead
   *  of re-sending an identical packet 30×/s. A low-rate keepalive still fires so a
   *  late-joining/recovering peer always has a fresh snapshot to dead-reckon from. */
  private lastSent?: { x: number; y: number; vx: number; vy: number; hasEgg: boolean; isInvincible: boolean; t: number };
  /** Last network snapshot per remote player ('mp-<userId>') for velocity
   *  extrapolation — lets remote players glide smoothly between packets. */
  private remoteNet: Record<string, { x: number; y: number; vx: number; vy: number; t: number }> = {};
  private onRemoteInput?: (payload: any) => void;
  private onEggOwner?: (payload: any) => void;
  private onMatchResult?: (payload: any) => void;
  private onRoomRejoined?: (payload: any) => void;
  private onPowerUsed?: (payload: any) => void;
  /** Highest egg-owner sequence applied; older updates are ignored. */
  private eggSeq = 0;
  /** Last claim sent per claimer, to throttle claims while touching. */
  private lastClaimAt: Record<string, number> = {};
  /** Online: our clock hit zero and we're waiting for the server's result. */
  private resultFallback?: Phaser.Time.TimerEvent;
  /** Online-MP agent-fill: this client is the single authority that STEERS the
   *  fill-agents and broadcasts their state. Computed deterministically (smallest
   *  human user_id) so every client agrees on exactly one driver — no double spend,
   *  no fighting over bot movement. Non-authority clients render them off the network. */
  private agentAuthority = false;
  private onAgentState?: (payload: any) => void;
  private lastAgentStateSend = 0;
  /**
   * When we last heard the authority broadcast agent positions.
   *
   * The authority used to be picked once at match start and never revisited, which meant
   * that if that player dropped — refreshed, closed the tab, lost signal — nobody took
   * over. The bots simply froze in place for everyone else for the rest of the match, and
   * from the inside that is indistinguishable from "the AI doesn't work". A 60-second
   * match gives you no time to notice and re-host.
   *
   * So non-authority clients now watch for silence and promote themselves. See
   * `maybeTakeOverAgents`.
   */
  private lastAgentStateAt = 0;
  /** Our position in the deterministic authority order; stagger failover by rank so two
   *  clients don't promote themselves in the same instant. */
  private authorityRank = 0;

  // Window-level input handlers (bound in create, removed on shutdown). Window-level
  // — not canvas-scoped — so movement keeps working even when a HUD button has focus.
  private onWinKeyDown?: (e: KeyboardEvent) => void;
  private onWinKeyUp?: (e: KeyboardEvent) => void;
  private onWinBlur?: () => void;
  private onWinVisibility?: () => void;

  // --- Bot voice (see botVoice.ts and server/src/botVoice.ts) ---
  private lastVoiceAt = 0;
  private botVoiceAt: Record<string, number> = {};
  private finalCallDone = false;
  private botCloseAt: Record<string, number> = {};
  private onBotSaid?: (payload: any) => void;
  /** Throttle for pushing minimap blips to the store (~12Hz). */
  private lastMinimap = 0;
  /** Overhead taunt speech bubbles, keyed by player id (behavior stays in the HUD panel). */
  private tauntBubbles: Record<string, Phaser.GameObjects.Text> = {};

  private gsPlayers: Player[] = [];
  private gsObjects: GameObject[] = [];
  private gsKeys: { [key: string]: boolean } = {};
  private lastTagTime = 0;
  /** New egg holder is steal-proof until this timestamp (keep-away grace). */
  private eggGraceUntil = 0;
  private tagBackBlock: { newChaserId: string; prevChaserId: string; until: number } | null = null;
  private gameStartTime = 0;
  private currentPhase: 'countdown' | 'playing' = 'countdown';
  private countdownTimer = 3;
  private gameTimer = GAME_DURATION;
  /**
   * Wall-clock ms at which the 3s countdown began. Online it's the server's start time;
   * solo it's when the scene started, pushed forward by however long the pause menu was
   * open. Timing off the wall clock, not frame deltas, keeps the round 60 real seconds
   * on a phone that can't hold 30 FPS (frame deltas are clamped to 1/30s, so a slow
   * device used to play the whole round in slow motion).
   */
  private clockStart = 0;
  /** When the pause menu opened (solo only; online the room's clock keeps running). */
  private pausedAt: number | null = null;
  /** Last whole second of the clock we snapshotted on. */
  private lastClockSec = -1;
  /** The clock hit zero: the simulation stops. */
  private matchEnded = false;
  /** endGame() ran; guards against a late server result firing it again. */
  private gameOver = false;
  /** A beat of freeze when the egg changes hands with you involved (hit-stop). */
  private hitStopUntil = 0;

  private playerSprites: { [id: string]: Phaser.GameObjects.Container } = {};
  private objSprites: { [id: string]: Phaser.GameObjects.Container } = {};
  /**
   * Static art (props and ground decals) with its world bounds, for view culling.
   * Phaser draws every visible object each frame whether or not it's on screen, and the
   * arena has ~4,400 props, most of them hedge. Hiding what's outside the camera is the
   * difference between redrawing ~9,000 objects a frame and a few hundred.
   */
  private cullables: Array<{ obj: Phaser.GameObjects.Components.Visible; x0: number; y0: number; x1: number; y1: number; on: boolean }> = [];
  private lastCullView = { x: NaN, y: NaN, w: 0, h: 0 };
  /** Egg-on-the-ground visual; null while a player is carrying it. */
  private eggSprite: Phaser.GameObjects.Container | null = null;
  /** Edge-of-screen pointer toward the egg while it's off-camera. Created lazily. */
  private eggArrow: Phaser.GameObjects.Triangle | null = null;
  /** Last egg-tint state applied per sprite, so the per-frame draw can skip no-op writes. */
  private spriteTinted: Record<string, boolean> = {};
  private infernoSlowZones: Array<{ x: number; y: number; width: number; height: number }> = [];
  /** Interior room rects (tile coords) produced by the active map builder, used to
   *  scatter furniture/cover inside rooms without blocking doorways. */
  private mapRooms: Array<{ c0: number; r0: number; c1: number; r1: number; floor?: number }> = [];
  private mapDoorCells: Set<string> = new Set();
  private playerVelocity: Record<string, { vx: number; vy: number }> = {};
  private cameraTarget?: Phaser.GameObjects.Zone;
  private camTargetX = 0;
  private camTargetY = 0;
  private powerUpAuras: Record<string, Phaser.GameObjects.Arc> = {};
  /** Bot movement: detect stuck and recover. */
  private botStuckAccum: Record<string, { x: number; y: number; t: number }> = {};
  /** Solo difficulty; online fill-bots always play 'normal'. */
  private difficulty: Difficulty = 'normal';
  /** Each bot's current role and the point it's heading for, refreshed at its reaction speed. */
  private botMind: Record<string, { role: Role; aim: { x: number; y: number } | null; aimAt: number }> = {};
  private lastRoleAt = 0;
  /** Observed bot velocity (px/s), smoothed, so bots can lead each other too. */
  private botVel: Record<string, { vx: number; vy: number }> = {};
  private botLastPos: Record<string, { x: number; y: number }> = {};
  /** Which way each dino faces (true = left), and when it last turned. See faceToward. */
  private facingLeft: Record<string, boolean> = {};
  private facingAt: Record<string, number> = {};
  /** Each bot's heading (x part), smoothed over a few frames. */
  private botHeadX: Record<string, number> = {};
  /** Distance from the map edge to the inside of the hedge ring. */
  private arenaInset = 60;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Prefix every load with the Vite base URL so assets resolve under any base path.
    const base = import.meta.env.BASE_URL;
    // FreeEnviro grassland sheet — grass ground tile + tree/bush/dirt art. This single
    // sheet is the ONLY map tileset; ground is a seamless TileSprite, props are sub-rect
    // frames drawn as scaled images.
    this.load.spritesheet(TS_ENVIRO, `${base}assets/maps/FreeEnviro_Sheet_16px.png`, {
      frameWidth: SRC_TILE, frameHeight: SRC_TILE,
    });
    for (const [id, cfg] of Object.entries(CHAR_SPRITES)) {
      this.load.spritesheet(`dino_${id}`, `${base}assets/characters/dino_${cfg.name}.png`, {
        frameWidth: 24,
        frameHeight: 24,
      });
    }
  }

  init(data: any) {
    this.mapId = data.mapId || 'map-1';
    this.mapWidth = data.mapWidth || 1600;
    this.mapHeight = data.mapHeight || 1000;
    this.gameMode = data.gameMode || 'single-player';
    this.serverStartTime = data.serverStartTime || null;
    this.roomCode = data.roomCode || null;
    this.localUserId = useGameStore.getState().userId || undefined;
    this.isOnlineMp = this.gameMode === 'multiplayer' && !useGameStore.getState().multiplayerHiddenFill;
    this.difficulty = this.gameMode === 'single-player' ? useGameStore.getState().difficulty : 'normal';
    this.agentAuthority = this.computeAgentAuthority();
  }

  /**
   * Online-MP only: am I the one client that drives the fill-agents? Pick the
   * connected human with the smallest user_id — a deterministic choice every client
   * computes identically, so exactly one client steers the bots, emits the
   * agent-tick (no duplicate inference spend), and broadcasts agent positions. If
   * the authority drops, the next-smallest naturally takes over on the next match.
   * Single-player / hidden-fill don't use this (they always own their own bots).
   */
  private computeAgentAuthority(): boolean {
    if (!this.isOnlineMp) return true;
    const roster = useGameStore.getState().roomPlayers || [];
    const ids = roster.map((p: any) => String(p.user_id)).filter(Boolean).sort();
    this.authorityRank = Math.max(0, ids.indexOf(String(this.localUserId)));
    return ids.length === 0 || ids[0] === String(this.localUserId);
  }

  /**
   * Promote ourselves to agent authority if the current one has gone quiet.
   *
   * The authority broadcasts agent positions ~30Hz, so silence for a full second means it
   * is gone — dropped, refreshed, or backgrounded hard enough to stop the loop. Without
   * this the bots stay frozen wherever they were standing until the match ends.
   *
   * Failover is staggered by `authorityRank` so the whole room does not promote at once:
   * the next-in-line waits ~1.2s, the one after ~2.4s. Whoever gets there first starts
   * broadcasting, everyone else keeps hearing agent-state and stands down on the next
   * frame. The ordering is the same deterministic user-id sort every client computes, so
   * the takeover order is agreed without any negotiation.
   */
  private maybeTakeOverAgents(now: number): void {
    if (!this.isOnlineMp || this.agentAuthority) return;
    if (!this.gsPlayers.some((p) => p.isBot)) return;
    // Nothing heard yet at all: start the clock from now rather than from 0, or every
    // client promotes itself on the first frame of the match.
    if (this.lastAgentStateAt === 0) { this.lastAgentStateAt = now; return; }

    // rank-1, so the most likely successor (rank 1, right behind the current authority)
    // reacts in the base window rather than waiting out a stagger slot it doesn't need.
    // Halves the freeze in the common case of the host alone dropping.
    const graceMs = AGENT_TAKEOVER_MS + Math.max(0, this.authorityRank - 1) * AGENT_TAKEOVER_STAGGER_MS;
    if (now - this.lastAgentStateAt < graceMs) return;

    this.agentAuthority = true;
    this.lastAgentStateAt = now;
    console.info('[agents] authority went quiet — taking over bot steering');
  }

  create() {
    const store = useGameStore.getState();
    const { selectedCharacter, setGamePhase, setPlayers, setGameObjects, setTimeRemaining, setCountdownTimer } = store;
    if (!selectedCharacter) return;

    this.gameStartTime = this.serverStartTime || Date.now();
    this.botMind = {};
    this.tauntBubbles = {};
    this.lastVoiceAt = 0;
    this.botVoiceAt = {};
    this.botCloseAt = {};
    this.finalCallDone = false;
    this.botVel = {};
    this.botLastPos = {};
    this.facingLeft = {};
    this.facingAt = {};
    this.botHeadX = {};
    this.lastRoleAt = 0;
    this.cullables = [];
    this.lastCullView = { x: NaN, y: NaN, w: 0, h: 0 };
    this.botStuckAccum = {};
    this.tagBackBlock = null;
    this.lastTagTime = 0;

    // Audio: load sounds (idempotent) + start the chase theme. Stop everything when
    // the scene tears down (leave / restart / navigate) so it doesn't bleed across.
    audioManager.init();
    audioManager.playTheme();
    this.events.once('shutdown', () => { audioManager.stopTheme(); audioManager.stopRunning(); });
    this.events.once('destroy', () => { audioManager.stopTheme(); audioManager.stopRunning(); });

    // Multiplayer: derive the phase + remaining time from the shared server clock so a
    // refresh/reconnect resumes the match where it is (skip the 3-2-1 if it already
    // started) instead of restarting at full time. Single-player always opens fresh.
    let startPhase: 'countdown' | 'playing' = 'countdown';
    let startCountdown = 3;
    let startTimer = GAME_DURATION;
    if (this.gameMode === 'multiplayer' && this.serverStartTime) {
      const elapsed = Math.floor((Date.now() + getServerOffset() - this.serverStartTime) / 1000);
      const afterCountdown = elapsed - 3; // 3s pre-game countdown
      if (afterCountdown >= 0) {
        startPhase = 'playing';
        startCountdown = 0;
        startTimer = Math.max(1, GAME_DURATION - afterCountdown);
      } else {
        startCountdown = Math.max(1, 3 - Math.max(0, elapsed));
      }
    }
    this.currentPhase = startPhase;
    this.countdownTimer = startCountdown;
    this.gameTimer = startTimer;
    this.clockStart = this.gameMode === 'multiplayer' && this.serverStartTime
      ? this.serverStartTime - getServerOffset()
      : Date.now();
    this.pausedAt = null;
    this.matchEnded = false;
    this.gameOver = false;
    this.eggSeq = 0;
    this.lastClaimAt = {};
    setGamePhase(startPhase);
    setCountdownTimer(startCountdown);
    setTimeRemaining(startTimer);
    if (startPhase === 'countdown') audioManager.play('beep');

    // All maps are the FreeEnviro grassland now. Multiplayer uses FIXED dimensions so
    // every client builds the SAME forest (identical bounds + obstacle layout);
    // single-player grows with the screen but stays a roomy clearing.
    const cols = this.gameMode === 'multiplayer'
      ? MP_MAP_COLS
      : Math.max(150, Math.ceil(this.scale.width / TECH_TILE_SIZE) + 6);
    const rows = this.gameMode === 'multiplayer'
      ? MP_MAP_ROWS
      : Math.max(98, Math.ceil(this.scale.height / TECH_TILE_SIZE) + 6);
    
    const borderThickness = 12;
    this.mapWidth = (cols - 2 * borderThickness) * TECH_TILE_SIZE;
    this.mapHeight = (rows - 2 * borderThickness) * TECH_TILE_SIZE;

    // Camera AND physics share the exact playable rect — the bush hedge IS the visible
    // edge, with no empty margin beyond it to wander/teleport into.
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setBackgroundColor(0x5e8038); // grass green behind the tilemap

    // Builds the grass ground layer + dirt paths and returns every obstacle collider
    // (forest border, tree groves, bush clumps, plateau landmarks) with its propType.
    const objects = this.buildGrassland();
    this.registerAnimations();
    this.setDinoTextureFilter();
    this.registerPropFrames();
    this.gsObjects = objects;
    setGameObjects(objects);
    objects.forEach(obj => this.createObjSprite(obj));

    const players: Player[] = [];
    const humanUserId = store.userId || undefined;

    // Spawn players in a circle around the exact center of the map.
    const centerX = this.mapWidth / 2;
    const centerY = this.mapHeight / 2;
    const spawnRadius = 80;
    // Snap each ring position to the nearest open spot so nobody ever starts inside a
    // bush/tree. Deterministic (same obstacle layout + algorithm) so MP clients agree.
    const spawnAt = (angle: number) =>
      this.nearestFreePoint(centerX + Math.cos(angle) * spawnRadius, centerY + Math.sin(angle) * spawnRadius, objects);

    if (this.gameMode === 'multiplayer' && store.multiplayerHiddenFill) {
      const localSpawn = spawnAt(0);
      players.push({
        id: 'player',
        x: localSpawn.x,
        y: localSpawn.y,
        character: selectedCharacter,
        isBot: false,
        hasEgg: false,
        eggHoldCount: 0,
        userId: humanUserId,
        powerUpReady: false,
        powerUpActive: false,
        powerUpCooldown: 0,
        isInvincible: false,
        speedBoostActive: false,
      });
      const availChars = characters.filter((c) => c.id !== selectedCharacter.id);
      const shuffled = [...availChars].sort(() => Math.random() - 0.5);
      const botCount = Math.min(3, shuffled.length);
      for (let i = 0; i < botCount; i++) {
        const angle = ((i + 1) * Math.PI * 2) / (botCount + 1);
        const bp = spawnAt(angle);
        players.push({
          id: `bot-${i}`,
          x: bp.x,
          y: bp.y,
          character: shuffled[i],
          isBot: true,
          hasEgg: false,
          eggHoldCount: 0,
          userId: `guest_${(0xe700 + i).toString(16)}`,
          powerUpReady: false,
          powerUpActive: false,
          powerUpCooldown: 0,
          isInvincible: false,
          speedBoostActive: false,
        });
      }
    } else {
      // Deterministic spawn angles from the room roster so every client agrees on
      // where each player starts. Local user is 'player'; the rest are network-driven.
      const room = this.gameMode === 'multiplayer' ? (store.roomPlayers || []) : [];
      const ordered = [...room].sort((a: any, b: any) => String(a.user_id).localeCompare(String(b.user_id)));
      // Online-MP agent-fill: top up empty seats with AI agents so a half-full room is
      // still a full match. Reserve ring slots for them up front so humans + agents all
      // get distinct, deterministic spawn points every client agrees on.
      const FILL_TARGET = 4;
      const fillCount = this.gameMode === 'multiplayer' ? Math.max(0, FILL_TARGET - ordered.length) : 0;
      const slots = Math.max(ordered.length + fillCount, 1);
      const angleAt = (i: number) => (i / slots) * Math.PI * 2;
      const localIdx = ordered.findIndex((rp: any) => rp.user_id === humanUserId);
      const la = angleAt(localIdx >= 0 ? localIdx : 0);

      const localSpawn = spawnAt(la);
      players.push({
        id: 'player', x: localSpawn.x, y: localSpawn.y, character: selectedCharacter,
        isBot: false, hasEgg: false, eggHoldCount: 0, userId: humanUserId,
        powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
      });

      if (this.gameMode === 'single-player') {
        const availChars = characters.filter(c => c.id !== selectedCharacter.id);
        const botCount = Math.min(3, availChars.length);
        const shuffled = [...availChars].sort(() => Math.random() - 0.5);
        for (let i = 0; i < botCount; i++) {
          const angle = ((i + 1) * Math.PI * 2) / (botCount + 1);
          const bp = spawnAt(angle);
          players.push({
            id: `bot-${i}`, x: bp.x, y: bp.y, character: shuffled[i],
            isBot: true, hasEgg: false, eggHoldCount: 0,
            powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
          });
        }
      } else {
        // Other humans in the room — driven by the network (player-input), not local AI.
        ordered.forEach((rp: any, i: number) => {
          if (rp.user_id === humanUserId) return;
          const a = angleAt(i);
          const remoteSpawn = spawnAt(a);
          const cid = Number(rp.character_id);
          const char = characters.find(c => Number(c.id.split('-')[1]) === cid) || characters[i % characters.length];
          players.push({
            id: `mp-${rp.user_id}`, x: remoteSpawn.x, y: remoteSpawn.y, character: char,
            isBot: false, hasEgg: false, eggHoldCount: 0, userId: rp.user_id,
            powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
          });
        });

        // AI fill-agents for the empty seats. Deterministic id/character/spawn on every
        // client; the authority steers them and broadcasts their state (see updateBots /
        // updateMultiplayerNet), non-authority clients render them off the network.
        if (fillCount > 0) {
          const usedCharNums = new Set(ordered.map((rp: any) => Number(rp.character_id)));
          const freeChars = characters
            .filter((c) => !usedCharNums.has(Number(c.id.split('-')[1])))
            .sort((a, b) => a.id.localeCompare(b.id));
          for (let i = 0; i < fillCount && i < freeChars.length; i++) {
            const bp = spawnAt(angleAt(ordered.length + i));
            players.push({
              id: `bot-${i}`, x: bp.x, y: bp.y, character: freeChars[i],
              isBot: true, hasEgg: false, eggHoldCount: 0, userId: `agent_${i}`,
              powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
            });
          }
        }
      }
    }

    // Resume a single-player match in progress if a fresh snapshot exists (refresh
    // recovery). Otherwise: the egg spawns on the floor and the first player to
    // touch it picks it up — no "starting chaser".
    const restored = this.tryRestoreSnapshot(objects);
    const finalPlayers = restored ? restored.players : players;
    if (restored) {
      this.gameTimer = restored.gameTimer;
      // Resume with the same time left: pretend the countdown and the elapsed part of
      // the round happened just now.
      this.clockStart = Date.now() - (3 + (GAME_DURATION - restored.gameTimer)) * 1000;
      this.currentPhase = 'playing';
      this.countdownTimer = 0;
      setCountdownTimer(0);
      setTimeRemaining(this.gameTimer);
      setGamePhase('playing');
      useGameStore.getState().setEgg(restored.eggOwnerId, restored.eggPosition);
      if (!restored.eggOwnerId && restored.eggPosition) this.spawnWorldEgg(restored.eggPosition.x, restored.eggPosition.y);
    } else {
      // Place the egg in the open centre of the map (snapped clear of any obstacle).
      const eggPt = this.nearestFreePoint(centerX, centerY, objects);
      store.setEgg(null, { x: eggPt.x, y: eggPt.y });
      this.spawnWorldEgg(eggPt.x, eggPt.y);
    }

    // Every bot gets a stable persona from its slot, so the bots feel different even with
    // no LLM. The LLM can still restyle them.
    let botSlot = 0;
    for (const p of finalPlayers) {
      if (p.isBot && !p.persona) p.persona = PERSONAS[botSlot % PERSONAS.length];
      if (p.isBot) botSlot++;
    }

    this.gsPlayers = finalPlayers;
    setPlayers(finalPlayers);
    finalPlayers.forEach(p => this.createPlayerSprite(p));

    // One line that answers "why are there no AI opponents" without a debugger: how many
    // humans the roster had, how many agents we filled with, and whether this client is
    // the one steering them. A room that reports humans=1 agents=0 is a roster that never
    // arrived, which looks identical in-game to the AI being broken.
    if (this.gameMode === 'multiplayer') {
      const agents = finalPlayers.filter((p) => p.isBot).length;
      const humans = finalPlayers.length - agents;
      console.info(
        `[agents] humans=${humans} agents=${agents} authority=${this.agentAuthority} ` +
        `rank=${this.authorityRank} roster=${(store.roomPlayers || []).length}`,
      );
    }

    // Save once a second + when the tab is hidden, so a refresh resumes here.
    this.registerSnapshotHooks();

    const humanSprite = this.playerSprites['player'];
    if (humanSprite) {
      this.cameraTarget = this.add.zone(humanSprite.x, humanSprite.y, 2, 2);
      this.camTargetX = humanSprite.x;
      this.camTargetY = humanSprite.y;
      this.cameras.main.startFollow(
        this.cameraTarget,
        true,
        CAMERA_FOLLOW_LERP_X,
        CAMERA_FOLLOW_LERP_Y
      );
      this.cameras.main.setDeadzone(28, 22);
      // Gentle follow zoom (1.3 max) — clamp down on small viewports so more of the map stays visible.
      const zoom = Math.min(CAMERA_ZOOM, Math.max(1.0, this.scale.width / 1100));
      this.cameras.main.setZoom(zoom);
      this.scale.on('resize', () => {
        const z = Math.min(CAMERA_ZOOM, Math.max(1.0, this.scale.width / 1100));
        this.cameras.main.setZoom(z);
      });
    }

    // Window-level key handling (not Phaser's canvas-scoped input): movement keeps
    // working even after clicking a HUD button, and we can clear keys on focus loss
    // so a missed keyup (Cmd+Tab on Mac, clicking away) can't leave a key "stuck"
    // and the dino drifting.
    const ARROWS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    this.onWinKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (ARROWS.has(k)) e.preventDefault(); // arrows would scroll the page
      this.gsKeys[k] = true;
      if (k === ' ' && this.currentPhase === 'playing') {
        e.preventDefault(); // space would scroll / trigger a focused button
        const hp = this.gsPlayers.find((p) => p.id === 'player');
        if (hp && hp.powerUpReady && !hp.powerUpActive && !hp.powerUpCooldown) {
          this.activatePowerUp(hp);
        }
      }
    };
    this.onWinKeyUp = (e: KeyboardEvent) => {
      this.gsKeys[e.key.toLowerCase()] = false;
    };
    // Any focus/visibility loss → drop every held key so nothing sticks.
    this.onWinBlur = () => { this.gsKeys = {}; };
    this.onWinVisibility = () => { if (document.hidden) this.gsKeys = {}; };

    window.addEventListener('keydown', this.onWinKeyDown);
    window.addEventListener('keyup', this.onWinKeyUp);
    window.addEventListener('blur', this.onWinBlur);
    document.addEventListener('visibilitychange', this.onWinVisibility);

    this.events.once('shutdown', () => {
      if (this.onWinKeyDown) window.removeEventListener('keydown', this.onWinKeyDown);
      if (this.onWinKeyUp) window.removeEventListener('keyup', this.onWinKeyUp);
      if (this.onWinBlur) window.removeEventListener('blur', this.onWinBlur);
      if (this.onWinVisibility) document.removeEventListener('visibilitychange', this.onWinVisibility);
      this.onWinKeyDown = this.onWinKeyUp = undefined;
      this.onWinBlur = this.onWinVisibility = undefined;
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, MAX_SIM_DELTA);
    const store = useGameStore.getState();
    this.syncPlayersFromStore();
    if (this.isOnlineMp) this.updateMultiplayerNet(_time);
    // Promote ourselves if whoever was steering the bots has gone silent, so a host
    // dropping mid-match doesn't leave the agents frozen for everyone else.
    this.maybeTakeOverAgents(_time);
    this.updateMinimap(_time);
    this.updateEggArrow();

    // Solo: the pause menu stops the clock. Online: the room's clock never stops, so the
    // match still ends on time for everyone while one player has the menu open.
    if (store.paused && !this.isOnlineMp) {
      if (this.pausedAt === null) this.pausedAt = Date.now();
    } else {
      if (this.pausedAt !== null) {
        this.clockStart += Date.now() - this.pausedAt;
        this.pausedAt = null;
      }
      this.advanceClock(store);
      if (this.matchEnded) return;
    }

    // The in-game menu freezes the simulation; sprites below still render so the
    // frozen world stays visible behind the overlay.
    if (!store.paused) {
      if (this.currentPhase === 'playing' && Date.now() < this.hitStopUntil) {
        // Hit-stop: hold the frame for a beat so a steal lands.
      } else if (this.currentPhase === 'playing') {
        // Time with the egg, for the results table. Online the server's tally replaces it.
        const holding = this.gsPlayers.find((p) => p.hasEgg);
        if (holding) holding.eggHeldMs = (holding.eggHeldMs ?? 0) + Math.min(delta, 250);
        this.updateMovement(dt);
        this.updateBots(dt);
        this.updateTagging();
        this.updatePowerUps(dt);
        this.updateCameraLead(dt);
      } else {
        audioManager.stopRunning(); // not in play (countdown) — no footsteps
      }
    } else {
      audioManager.stopRunning(); // paused — silence footsteps
    }

    this.gsPlayers.forEach(p => {
      const sprite = this.playerSprites[p.id];
      if (!sprite) return;
      let tx = p.x;
      let ty = p.y;
      if (p.id !== 'player') {
        // Dead-reckon remote players along their last-known velocity so they glide
        // smoothly between 30Hz packets instead of stuttering toward each stale point.
        const net = this.remoteNet[p.id];
        if (net) {
          const age = Math.min((this.time.now - net.t) / 1000, REMOTE_EXTRAPOLATE_MS / 1000);
          tx = net.x + net.vx * age;
          ty = net.y + net.vy * age;
        }
      }
      const follow = p.id === 'player' ? LOCAL_PLAYER_SPRITE_FOLLOW : REMOTE_PLAYER_SPRITE_FOLLOW;
      const nx = Phaser.Math.Linear(sprite.x, tx, follow);
      const ny = Phaser.Math.Linear(sprite.y, ty, follow);
      const dx = tx - sprite.x;
      const dy = ty - sprite.y;
      sprite.setPosition(nx, ny);
      sprite.setDepth(p.y);

      // By name, not index: a power aura is inserted behind the dino, which shifted the
      // indices and froze the dino's facing and animation for as long as the power ran.
      const spr = sprite.getByName('dino') as Phaser.GameObjects.Sprite | null;
      if (!spr) return;

      const moving = Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3;
      const sid = this.getSpriteId(p);

      // Humans face where they're heading: the local player's input velocity, a peer's
      // reported one. Bots set their facing as they steer (moveTowards) or from the
      // steering client's agent-state.
      if (!p.isBot) {
        const v = p.id === 'player' ? this.playerVelocity['player'] : this.remoteNet[p.id];
        const sp = v ? Math.hypot(v.vx, v.vy) : 0;
        if (v && sp > 20) this.faceToward(p.id, v.vx / sp);
      }
      spr.setFlipX(this.facingLeft[p.id] === true);

      if (moving && !p.isInvincible) {
        spr.play(`run_${sid}_anim`, true);
      } else {
        spr.play(`idle_${sid}_anim`, true);
      }

      // Tint changes are cheap but not free, and `hasEgg` flips at most a handful of
      // times a round — so track the applied value rather than reasserting every frame.
      const wantTint = p.hasEgg;
      if (this.spriteTinted[p.id] !== wantTint) {
        if (wantTint) spr.setTint(0xfacc15);
        else spr.clearTint();
        this.spriteTinted[p.id] = wantTint;
      }

      // YOU: green, egg-holder: warm yellow, others: white.
      const isSelf = p.id === 'player';
      const markerColor = p.hasEgg ? 0xfacc15 : (isSelf ? 0x4ade80 : 0xffffff);
      /**
       * Only touch the text objects when something actually changed.
       *
       * Phaser's Text.setText and setColor both regenerate the object's texture — a
       * canvas redraw plus a GPU upload — and neither checks whether the value differs
       * first. These ran unconditionally for every player every frame, so six players at
       * 60fps cost more than a thousand texture rebuilds a second to redraw names that
       * change maybe twice a match. That is the stutter.
       *
       * setScale is cheap by comparison (no texture work), but it is guarded by the same
       * check for free.
       */
      const nameTag = sprite.getByName('name') as Phaser.GameObjects.Text | null;
      const marker = sprite.getByName('marker') as Phaser.GameObjects.Text | null;
      const label = isSelf ? 'YOU' : p.character.name;
      const css = this.colorToCss(markerColor);
      if (nameTag) {
        if (nameTag.text !== label) nameTag.setText(label);
        if (nameTag.style.color !== css) nameTag.setColor(css);
        const s = isSelf ? 1.05 : 1;
        if (nameTag.scaleX !== s) nameTag.setScale(s);
      }
      if (marker) {
        if (marker.style.color !== css) marker.setColor(css);
        const s = isSelf || p.hasEgg ? 1.12 : 1;
        if (marker.scaleX !== s) marker.setScale(s);
      }

      const bob = moving ? Math.sin(this.time.now * 0.012) * 1.5 : 0;
      spr.y = -12 + bob;

      // Shielded dinos go see-through, not invisible, so you can still track them.
      sprite.setAlpha(p.isInvincible ? 0.5 : 1);
    });

    this.cullProps();
    this.renderAgentTaunts();
  }

  /** Hide static art outside the camera (plus a margin), show it again as it comes into view. */
  private cullProps() {
    const v = this.cameras.main.worldView;
    if (v.width === 0 || this.cullables.length === 0) return;
    // Only re-test when the view has moved or resized by a noticeable amount.
    const last = this.lastCullView;
    if (Math.abs(v.x - last.x) < 24 && Math.abs(v.y - last.y) < 24 && v.width === last.w && v.height === last.h) return;
    this.lastCullView = { x: v.x, y: v.y, w: v.width, h: v.height };
    const pad = 160;
    const x0 = v.x - pad, y0 = v.y - pad, x1 = v.right + pad, y1 = v.bottom + pad;
    for (const c of this.cullables) {
      const on = c.x1 > x0 && c.x0 < x1 && c.y1 > y0 && c.y0 < y1;
      if (on !== c.on) {
        c.on = on;
        c.obj.setVisible(on);
      }
    }
  }

  /** Overhead taunt bubbles above each agent (the agent's TACTIC lives in the HUD
   *  bots panel; only the trash-talk is shown in-world, transiently, so it
   *  doesn't stack into a cluttered mess). */
  private renderAgentTaunts() {
    if (!this.gsPlayers.some((p) => p.isBot)) return;
    const nowT = Date.now();
    for (const p of this.gsPlayers) {
      if (!p.isBot) continue;
      const fresh = !!(p.taunt && p.tauntAt && nowT - p.tauntAt < TAUNT_TTL_MS);
      let bubble = this.tauntBubbles[p.id];
      if (!fresh) { bubble?.setVisible(false); continue; }
      if (!bubble) {
        bubble = this.add
          .text(0, 0, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#2b2410',
            backgroundColor: '#fde68a', padding: { x: 6, y: 3 }, align: 'center',
            wordWrap: { width: 150 },
          })
          .setOrigin(0.5, 1)
          .setDepth(100000);
        this.tauntBubbles[p.id] = bubble;
      }
      const age = nowT - (p.tauntAt as number);
      const fade = age > TAUNT_TTL_MS - 600 ? Math.max(0, (TAUNT_TTL_MS - age) / 600) : 1;
      bubble
        .setText(p.taunt as string)
        .setPosition(p.x, p.y - 74) // above the nametag so they don't overlap
        .setAlpha(fade)
        .setVisible(true);
    }
  }

  // ===================== MAP =====================

  private drawTechRoomBackground() {
    const source = this.textures.get(TECH_ROOM_BG_KEY).getSourceImage() as HTMLImageElement;
    const srcW = source?.width || 937;
    const srcH = source?.height || 835;

    const scale = this.mapHeight / srcH;
    const roomW = srcW * scale;
    const overlap = 140 * scale;
    const secondX = roomW - overlap;

    // Left section (authored room)
    this.add
      .image(0, 0, TECH_ROOM_BG_KEY)
      .setOrigin(0, 0)
      .setScale(scale)
      .setDepth(0);

    // Right section: mirrored continuation for visual variety without style break.
    this.add
      .image(secondX + roomW, 0, TECH_ROOM_BG_KEY)
      .setOrigin(1, 0)
      .setScale(scale)
      .setFlipX(true)
      .setDepth(0);

    // Blend seam so transition feels continuous.
    const seam = this.add.graphics().setDepth(1);
    seam.fillStyle(0x2f3f5d, 0.18);
    seam.fillRect(secondX - 28, 0, 56, this.mapHeight);
  }

  private drawSummerPlainsBackground() {
    const layout = this.getSummerSceneLayout();
    if (!layout || layout.length === 0) {
      this.drawFallbackBackground();
      return;
    }

    // Build a continuous summer path with integer positioning and tiny overlap.
    let x = 0;
    let idx = 0;
    while (x < this.mapWidth + 80) {
      const panel = layout[idx % layout.length];
      this.add
        .image(Math.floor(x), 0, panel.key)
        .setOrigin(0, 0)
        .setScale(panel.scale)
        .setDepth(0);

      // Slight overlap prevents any camera/background crack between panels.
      x += panel.width - panel.overlap;
      idx += 1;
    }

    const tint = this.add.graphics().setDepth(1);
    tint.fillStyle(0x102a12, 0.08);
    tint.fillRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private getSummerSceneLayout(): Array<{ key: string; scale: number; width: number; overlap: number }> | null {
    const panels: Array<{
      key: string;
      scale: number;
      width: number;
      overlap: number;
    }> = [];

    SUMMER_SCENE_KEYS.forEach((key) => {
      const src = this.textures.get(key)?.getSourceImage() as HTMLImageElement | undefined;
      if (!src || !src.width || !src.height) return;
      const scale = this.mapHeight / src.height;
      const overlap = Math.max(8, Math.floor(this.mapHeight * 0.012));
      panels.push({
        key,
        scale,
        width: src.width * scale,
        overlap,
      });
    });

    return panels.length ? panels : null;
  }

  /**
   * Build the FreeEnviro grassland: a lush grass-tile ground crossed by organic dirt
   * paths + clearings, ringed by a dense forest border, with tree groves, bush clumps
   * and the occasional raised "plateau" landmark scattered between WIDE open lanes so
   * there's always a proper route to run and chase. Grass tufts + flower (clover)
   * patches add detail. Returns every obstacle collider (with its propType) for
   * createObjSprite; dirt/grass details are drawn here as non-colliding decals.
   */
  private buildGrassland(): GameObject[] {
    const cell = TECH_TILE_SIZE; // 32px world cell (one 16px tile @2x)
    const cols = Math.floor(this.mapWidth / cell);
    const rows = Math.floor(this.mapHeight / cell);
    this.infernoSlowZones = []; // the grassland has no slow zones

    // Seeded RNG so the forest regenerates IDENTICALLY on every load — this keeps
    // refresh-resume positions valid (a saved player can't land inside a tree that
    // only exists in a different random layout). In multiplayer we mix in the shared
    // room code so EVERY client in a room builds the exact same layout, while
    // different rooms still vary.
    let s = (cols * 73856093) ^ (rows * 19349663) ^ 0x9e3779b9;
    if (this.gameMode === 'multiplayer' && this.roomCode) {
      for (let i = 0; i < this.roomCode.length; i++) s = (Math.imul(s, 31) + this.roomCode.charCodeAt(i)) | 0;
    }
    const rng = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    // 1) Lush grass ground — ONE seamless repeating TileSprite. (A tilemap of
    //    identical tiles shows hard grid-line seams at this zoom/scale, so we tile a
    //    single 16px grass texture instead — 16 is power-of-two so WebGL REPEAT is
    //    seam-free.) Crop the grass cell to its own texture to avoid atlas bleed.
    if (!this.textures.exists(GRASS_FILL_KEY)) {
      const src = this.textures.get(TS_ENVIRO).getSourceImage() as HTMLImageElement;
      const ct = this.textures.createCanvas(GRASS_FILL_KEY, SRC_TILE, SRC_TILE);
      if (ct) {
        ct.context.drawImage(src, GRASS_SRC_X, GRASS_SRC_Y, SRC_TILE, SRC_TILE, 0, 0, SRC_TILE, SRC_TILE);
        ct.refresh();
        ct.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    this.add.tileSprite(0, 0, this.mapWidth, this.mapHeight, GRASS_FILL_KEY)
      .setOrigin(0, 0)
      .setTileScale(WORLD_SCALE, WORLD_SCALE)
      .setDepth(-10);
    // Decals reference named sub-rect frames — make sure they exist before drawing.
    this.registerPropFrames();

    const objects: GameObject[] = [];
    const occupied = new Set<string>();
    const borderThickness = 12;
    this.arenaInset = borderThickness * cell + PLAYER_SIZE;

    // The build grid (cols×rows) tiles the playable area 1:1 (cols = mapWidth/cell), so
    // a cell maps straight to world px — NO border offset. (The old −borderThickness*cell
    // shift pushed the whole obstacle field ~384px off, so the cleared centre plaza no
    // longer lined up with where players + egg spawn → they landed in bushes.)
    const place = (type: string, c: number, r: number) => {
      let w = 36, h = 30;                                   // trees: snug trunk base
      if (type === 'plateau') { w = 72; h = 60; }
      else if (type.startsWith('bush')) { w = 56; h = 44; }
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      objects.push({
        id: `prop-${objects.length}`,
        x, y, width: w, height: h, type: 'furniture', color: '#000', propType: type, isPushable: false
      });
    };

    // Non-colliding ground decal (dirt patch / grass tuft / flowers) — same 1:1 mapping
    // so it lines up with where players actually run.
    const decal = (name: string, c: number, r: number, depth: number, scale: number, alpha = 1) => {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      const img = this.add.image(x, y, TS_ENVIRO, name).setOrigin(0.5).setScale(scale).setDepth(depth).setAlpha(alpha);
      const hw = (img.width * scale) / 2, hh = (img.height * scale) / 2;
      this.cullables.push({ obj: img, x0: x - hw, y0: y - hh, x1: x + hw, y1: y + hh, on: true });
    };

    const treeType = () => (['tree_a', 'tree_b', 'tree_c'] as const)[(rng() * 3) | 0];
    const bushType = () => (rng() > 0.5 ? 'bush_md' : 'bush_dk');

    const cc = Math.floor(cols / 2);
    const cr = Math.floor(rows / 2);

    // Mark cells as occupied (reserves a rect + 1-cell padding around it)
    const reserve = (c: number, r: number, wCells: number, hCells: number) => {
      for (let i = -1; i <= wCells; i++) {
        for (let j = -1; j <= hCells; j++) occupied.add(`${c + i},${r + j}`);
      }
    };
    const isOccupied = (c: number, r: number, wCells: number, hCells: number): boolean => {
      for (let i = -1; i <= wCells; i++) {
        for (let j = -1; j <= hCells; j++) if (occupied.has(`${c + i},${r + j}`)) return true;
      }
      return false;
    };

    // ── LAYER 1: Bush border — the map is surrounded by bushes on all 4 sides
    //    (a dense, impassable hedge ring covering the FULL edge, incl. the outermost
    //    cells, so the hedge is flush with the camera/physics boundary — no gaps).
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isBorder = r < borderThickness || r > rows - borderThickness - 1 ||
                         c < borderThickness || c > cols - borderThickness - 1;
        if (isBorder) {
          place(bushType(), c, r);
          occupied.add(`${c},${r}`);
        }
      }
    }

    // ── LAYER 2: Dirt crossroads through the centre + a spawn-plaza clearing ──
    // Wide overlapping dirt patches form continuous winding paths; trees drawn later
    // sit on top, so the dirt reads as a road threading between the groves.
    const iC0 = borderThickness, iC1 = cols - borderThickness;
    const iR0 = borderThickness, iR1 = rows - borderThickness;
    for (let c = iC0; c < iC1; c += 3) {
      decal(rng() > 0.5 ? 'dirt_long' : 'dirt_big', c, cr + Math.round(rng() * 2 - 1), -9, 2, 0.95);
    }
    for (let r = iR0; r < iR1; r += 3) {
      decal(rng() > 0.5 ? 'dirt_long' : 'dirt_big', cc + Math.round(rng() * 2 - 1), r, -9, 2, 0.95);
    }
    // Big open dirt clearing where players + egg spawn.
    decal('dirt_big', cc, cr, -9, 2.6, 1);
    decal('dirt_long', cc - 2, cr + 1, -9, 2, 0.95);
    decal('dirt_long', cc + 2, cr - 1, -9, 2, 0.95);

    // ── LAYER 3: Groves / bush clumps / plateau landmarks on a plot grid, with WIDE
    //    open lanes between them (proper chase routes). Centre stays clear for spawn.
    const ROAD = 6;          // open corridor width between plots (cells, ~192px)
    const PLOT = 7;          // plot size (cells)
    const PERIOD = ROAD + PLOT;
    const plazaRadius = 12;  // keep a roomy OPEN arena at the centre for spawns + egg
                             // (10 was too tight in MP — a grove edge reached the spawn ring)

    const fillGrove = (c0: number, r0: number, density: number) => {
      for (let dr = 0; dr < PLOT; dr++) {
        for (let dc = 0; dc < PLOT; dc++) {
          if (rng() > density) continue;
          const gc = c0 + dc, gr = r0 + dr;
          if (occupied.has(`${gc},${gr}`)) continue;
          place(rng() > 0.42 ? treeType() : bushType(), gc, gr);
          occupied.add(`${gc},${gr}`);
        }
      }
    };

    for (let r = borderThickness + ROAD; r + PLOT <= rows - borderThickness; r += PERIOD) {
      for (let c = borderThickness + ROAD; c + PLOT <= cols - borderThickness; c += PERIOD) {
        const pcc = c + PLOT / 2;
        const pcr = r + PLOT / 2;
        if (Math.hypot(pcc - cc, pcr - cr) < plazaRadius) continue; // spawn plaza

        const roll = rng();
        if (roll < 0.4) {
          // Dense tree/bush grove — cover to weave through during a chase.
          fillGrove(c, r, 0.5);
        } else if (roll < 0.62) {
          // Loose bush clump around a small clearing.
          for (let k = 0; k < 4; k++) {
            const bc = c + 1 + ((rng() * (PLOT - 2)) | 0);
            const br = r + 1 + ((rng() * (PLOT - 2)) | 0);
            if (!occupied.has(`${bc},${br}`)) { place(bushType(), bc, br); occupied.add(`${bc},${br}`); }
          }
        } else if (roll < 0.74) {
          // Plateau landmark with a tree accent in a corner.
          const hc = c + 2, hr = r + 2;
          if (!isOccupied(hc, hr, 3, 3)) { place('plateau', hc, hr); reserve(hc, hr, 3, 3); }
          if (!occupied.has(`${c},${r}`)) { place(treeType(), c, r); occupied.add(`${c},${r}`); }
        } else if (roll < 0.86) {
          // Open dirt clearing dotted with flowers — a breather / sightline.
          const mc = c + (PLOT >> 1), mr = r + (PLOT >> 1);
          decal(rng() > 0.5 ? 'dirt_big' : 'dirt_long', mc, mr, -9, 2, 0.95);
          decal('clover', mc, mr, -8, 1.6, 0.9);
        }
        // else: fully open courtyard — left empty for fast running.
      }
    }

    // ── LAYER 4: Scatter ground detail (grass tufts, flowers, pebbly dirt) ──
    const scatterN = Math.floor((cols * rows) / 50);
    for (let i = 0; i < scatterN; i++) {
      const c = borderThickness + ((rng() * (cols - 2 * borderThickness)) | 0);
      const r = borderThickness + ((rng() * (rows - 2 * borderThickness)) | 0);
      if (occupied.has(`${c},${r}`)) continue;
      const k = rng();
      if (k < 0.45) decal(rng() > 0.5 ? 'tuft_a' : 'tuft_b', c, r, -8, 2, 0.9);
      else if (k < 0.7) decal('clover', c, r, -8, 1.4, 0.8);
      else if (k < 0.85) decal('dirt_small', c, r, -9, 2, 0.9);
    }

    return objects;
  }

  // ===================== REFRESH-RESUME SNAPSHOT (single-player) =====================

  /** Only local single-player (incl. solo bot-fill) snapshots; online uses server rejoin. */
  private snapshotEligible(): boolean {
    return this.gameMode !== 'multiplayer' || useGameStore.getState().multiplayerHiddenFill;
  }

  private saveSnapshot() {
    const store = useGameStore.getState();
    // Skip while paused — the menu's Leave/Restart actions clear the snapshot just
    // before navigating, and the resulting pagehide must not re-write it.
    if (!this.snapshotEligible() || this.currentPhase !== 'playing' || store.paused) return;
    try {
      const snap = {
        v: 1, savedAt: Date.now(), mapId: this.mapId, gameMode: this.gameMode,
        userId: store.userId ?? null, gameTimer: this.gameTimer,
        eggOwnerId: store.eggOwnerId, eggPosition: store.eggPosition,
        players: this.gsPlayers.map((p) => ({
          id: p.id, x: Math.round(p.x), y: Math.round(p.y), characterId: p.character.id,
          isBot: p.isBot, hasEgg: !!p.hasEgg, eggHoldCount: p.eggHoldCount ?? 0, userId: p.userId ?? null,
          powerUpReady: !!p.powerUpReady, powerUpActive: !!p.powerUpActive, powerUpCooldown: p.powerUpCooldown ?? 0,
        })),
      };
      localStorage.setItem('chase-game-snapshot', JSON.stringify(snap));
    } catch { /* ignore quota / serialise errors */ }
  }

  private clearSnapshot() {
    try { localStorage.removeItem('chase-game-snapshot'); } catch { /* ignore */ }
  }

  private registerSnapshotHooks() {
    const onVis = () => { if (document.visibilityState === 'hidden') this.saveSnapshot(); };
    const onHide = () => this.saveSnapshot();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    });
  }

  /** Rebuild the players + egg + timer from a fresh snapshot, or null to start normally. */
  private tryRestoreSnapshot(objects: GameObject[]): { players: Player[]; gameTimer: number; eggOwnerId: string | null; eggPosition: { x: number; y: number } | null } | null {
    if (!this.snapshotEligible()) return null;
    let snap: any;
    try {
      const raw = localStorage.getItem('chase-game-snapshot');
      if (!raw) return null;
      snap = JSON.parse(raw);
    } catch { return null; }
    const store = useGameStore.getState();
    if (!snap || snap.v !== 1) return null;
    if (snap.mapId !== this.mapId || snap.gameMode !== this.gameMode) return null;
    if ((snap.userId ?? null) !== (store.userId ?? null)) return null;
    if (Date.now() - (snap.savedAt || 0) > 10 * 60 * 1000) return null;
    if (!Array.isArray(snap.players) || snap.players.length === 0) return null;
    if (typeof snap.gameTimer !== 'number' || snap.gameTimer <= 0) return null;

    const players: Player[] = [];
    for (const sp of snap.players) {
      const character = characters.find((c) => c.id === sp.characterId);
      if (!character) return null;
      let x = sp.x, y = sp.y;
      if (checkCollision(x, y, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight)) {
        const free = this.nearestFreePoint(x, y, objects);
        x = free.x; y = free.y;
      }
      players.push({
        id: sp.id, x, y, character, isBot: !!sp.isBot, hasEgg: !!sp.hasEgg,
        eggHoldCount: sp.eggHoldCount ?? 0, userId: sp.userId ?? undefined,
        powerUpReady: !!sp.powerUpReady, powerUpActive: !!sp.powerUpActive,
        powerUpCooldown: sp.powerUpCooldown ?? 0, isInvincible: false, speedBoostActive: false,
      });
    }
    if (!players.some((p) => p.id === 'player')) return null;
    return { players, gameTimer: snap.gameTimer, eggOwnerId: snap.eggOwnerId ?? null, eggPosition: snap.eggPosition ?? null };
  }

  /** Closest collision-free point to (x,y); falls back to a safe spawn. */
  private nearestFreePoint(x: number, y: number, objects: GameObject[]): { x: number; y: number } {
    if (!checkCollision(x, y, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight)) return { x, y };
    for (let r = 16; r <= 256; r += 16) {
      for (let a = 0; a < 8; a++) {
        const nx = x + Math.cos((a / 8) * Math.PI * 2) * r;
        const ny = y + Math.sin((a / 8) * Math.PI * 2) * r;
        if (!checkCollision(nx, ny, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight)) return { x: nx, y: ny };
      }
    }
    return findSafeSpawnPosition(this.mapWidth, this.mapHeight, objects);
  }

  private drawFallbackBackground() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2f3f5d, 1);
    g.fillRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private drawInfernoBackground() {
    const layout = this.getInfernoLayout();
    if (!layout) {
      this.drawFallbackBackground();
      return;
    }

    const { scale1, scale2, width1, width2, overlap } = layout;

    // Solid underfill so any sub-pixel gap never reads as a harsh black void.
    const under = this.add.graphics().setDepth(-2);
    under.fillStyle(0x231008, 1);
    under.fillRect(0, 0, this.mapWidth, this.mapHeight);

    let x = 0;
    let useFirst = true;
    let idx = 0;

    // Cover full world width (mapWidth matches stitch from computeInfernoStitchedRightEdge).
    while (x < this.mapWidth && idx < 80) {
      const key = useFirst ? INFERNO_BG_1_KEY : INFERNO_BG_2_KEY;
      const scale = useFirst ? scale1 : scale2;
      const panelWidth = useFirst ? width1 : width2;
      this.add
        .image(Math.floor(x), 0, key)
        .setOrigin(0, 0)
        .setScale(scale)
        .setDepth(0);

      if (idx > 0) {
        const seam = this.add.graphics().setDepth(1);
        seam.fillStyle(0x2a1308, 0.07);
        seam.fillRect(Math.floor(x - overlap), 0, Math.ceil(overlap) + 2, this.mapHeight);
      }

      x += panelWidth - overlap;
      useFirst = !useFirst;
      idx++;
    }

    const overlay = this.add.graphics().setDepth(1);
    overlay.fillStyle(0x2a1308, 0.06);
    overlay.fillRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private getInfernoLayout(): {
    scale1: number;
    scale2: number;
    width1: number;
    width2: number;
    overlap: number;
  } | null {
    const src1 = this.textures.get(INFERNO_BG_1_KEY)?.getSourceImage() as HTMLImageElement | undefined;
    const src2 = this.textures.get(INFERNO_BG_2_KEY)?.getSourceImage() as HTMLImageElement | undefined;
    if (!src1 || !src2 || !src1.width || !src2.width || !src1.height || !src2.height) return null;
    const scale1 = this.mapHeight / src1.height;
    const scale2 = this.mapHeight / src2.height;
    const width1 = src1.width * scale1;
    const width2 = src2.width * scale2;
    // Keep overlap strong enough to prevent visible cracks between panels.
    const overlap = Math.max(22, this.mapHeight * 0.03);
    return { scale1, scale2, width1, width2, overlap };
  }

  /** Right edge of the stitched inferno strip until at least `minRight` is covered (same overlap as draw). */
  private computeInfernoStitchedRightEdge(minRight: number): number {
    const layout = this.getInfernoLayout();
    if (!layout) return minRight;
    const { width1, width2, overlap } = layout;
    let x = 0;
    let useFirst = true;
    let maxRight = 0;
    for (let i = 0; i < 64 && maxRight < minRight + 4; i++) {
      const pw = useFirst ? width1 : width2;
      maxRight = Math.max(maxRight, x + pw);
      x += pw - overlap;
      useFirst = !useFirst;
    }
    return maxRight;
  }

  private createInfernoCollisionObjects(): GameObject[] {
    this.infernoSlowZones = [];
    const layout = this.getInfernoLayout();
    if (!layout) return [];
    const { scale1, scale2, width1, width2, overlap } = layout;

    type Rect = { x: number; y: number; w: number; h: number };
    // Tuned to the lava_realm art: avoid full-bleed slabs that blocked the north path,
    // east bridge, southern neck, and bottom entrance on panel 2.
    const panel1Blockers: Rect[] = [
      { x: 0, y: 0, w: 340, h: 150 },
      { x: 684, y: 0, w: 340, h: 150 },
      { x: 0, y: 150, w: 240, h: 100 },
      { x: 784, y: 150, w: 240, h: 100 },
      { x: 0, y: 260, w: 110, h: 360 },
      { x: 914, y: 0, w: 110, h: 220 },
      { x: 914, y: 300, w: 110, h: 260 },
      { x: 914, y: 660, w: 110, h: 160 },
      { x: 0, y: 780, w: 340, h: 244 },
      { x: 684, y: 780, w: 340, h: 244 },
      { x: 0, y: 680, w: 180, h: 110 },
      { x: 844, y: 680, w: 180, h: 110 },
    ];
    const panel2Blockers: Rect[] = [
      { x: 0, y: 0, w: 340, h: 120 },
      { x: 684, y: 0, w: 340, h: 120 },
      { x: 0, y: 120, w: 100, h: 130 },
      { x: 924, y: 120, w: 100, h: 130 },
      { x: 0, y: 210, w: 95, h: 200 },
      { x: 929, y: 210, w: 95, h: 200 },
      { x: 0, y: 760, w: 360, h: 264 },
      { x: 664, y: 760, w: 360, h: 264 },
      { x: 0, y: 640, w: 120, h: 140 },
      { x: 904, y: 640, w: 120, h: 140 },
    ];
    const panel1Slow: Rect[] = [
      { x: 150, y: 220, w: 724, h: 70 },
      { x: 130, y: 740, w: 760, h: 70 },
      { x: 320, y: 500, w: 380, h: 80 },
    ];
    const panel2Slow: Rect[] = [
      { x: 140, y: 170, w: 744, h: 70 },
      { x: 140, y: 720, w: 744, h: 70 },
      { x: 350, y: 520, w: 320, h: 90 },
    ];

    const objects: GameObject[] = [];
    let xOffset = 0;
    let useFirst = true;
    let zoneIdx = 0;

    while (xOffset < this.mapWidth) {
      const scale = useFirst ? scale1 : scale2;
      const panelW = useFirst ? width1 : width2;
      const blockers = useFirst ? panel1Blockers : panel2Blockers;
      const slows = useFirst ? panel1Slow : panel2Slow;

      for (const z of blockers) {
        const inset = 8;
        const wx = xOffset + (z.x + inset) * scale;
        const wy = (z.y + inset) * scale;
        const ww = Math.max(12, (z.w - inset * 2) * scale);
        const wh = Math.max(12, (z.h - inset * 2) * scale);
        if (wx > this.mapWidth - 8 || wx + ww < 8) continue;
        objects.push({
          id: `inferno-block-${zoneIdx++}`,
          x: Math.max(0, wx),
          y: Math.max(0, wy),
          width: Math.min(ww, this.mapWidth - Math.max(0, wx)),
          height: Math.min(wh, this.mapHeight - Math.max(0, wy)),
          type: 'furniture',
          color: '#7c2d12',
          propType: 'vent',
          isPushable: false,
        });
      }

      for (const s of slows) {
        const wx = xOffset + s.x * scale;
        const wy = s.y * scale;
        const ww = s.w * scale;
        const wh = s.h * scale;
        if (wx > this.mapWidth - 8 || wx + ww < 8) continue;
        this.infernoSlowZones.push({
          x: Math.max(0, wx),
          y: Math.max(0, wy),
          width: Math.min(ww, this.mapWidth - Math.max(0, wx)),
          height: Math.min(wh, this.mapHeight - Math.max(0, wy)),
        });
      }

      xOffset += panelW - overlap;
      useFirst = !useFirst;
    }

    return objects;
  }

  /**
   * Build a procedural set of bushes / rocks / stumps spread across the
   * stitched summer map so map-2 stops reading as a flat painted background.
   * Seeded by mapWidth so the layout is deterministic across reloads.
   */
  private createSummerPlainsCollisionObjects(): GameObject[] {
    const objects: GameObject[] = [];
    const layout = this.getSummerSceneLayout();
    const stitched = layout
      ? layout.reduce((acc, p, idx) => acc + p.width - (idx === 0 ? 0 : p.overlap), 0)
      : this.mapWidth;
    const usableW = Math.max(this.mapWidth, stitched);
    const usableH = this.mapHeight;
    const margin = Math.max(80, usableH * 0.08);
    const playableTop = margin;
    const playableBottom = usableH - margin;
    const propTypes = ['bush', 'rock', 'stump', 'plant', 'bush', 'rock'] as const;

    // Deterministic pseudo-random sequence based on integer math, so the same
    // map width always yields the same prop layout (matters for multiplayer).
    let seed = Math.floor(usableW) ^ 0x9e3779b1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 0x10000;
    };

    const count = Math.max(7, Math.min(14, Math.floor(usableW / 220)));
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    let attempts = 0;
    while (objects.length < count && attempts < count * 30) {
      attempts++;
      const w = 64 + Math.floor(rand() * 56);   // 64..120 px wide
      const h = 56 + Math.floor(rand() * 52);   // 56..108 px tall
      const x = margin + rand() * Math.max(1, usableW - margin * 2 - w);
      const y = playableTop + rand() * Math.max(1, playableBottom - playableTop - h);
      const pad = 24;
      const overlapsExisting = placed.some(
        (r) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y
      );
      if (overlapsExisting) continue;
      placed.push({ x, y, w, h });
      const propType = propTypes[objects.length % propTypes.length];
      objects.push({
        id: `summer-prop-${objects.length}`,
        x,
        y,
        width: w,
        height: h,
        type: 'furniture',
        color: '#2a4a1f',
        propType,
        isPushable: false,
      });
    }
    return objects;
  }

  private isInInfernoSlowZone(x: number, y: number, size: number): boolean {
    if (this.mapId !== 'map-3' || this.infernoSlowZones.length === 0) return false;
    const half = size / 2;
    return this.infernoSlowZones.some((z) =>
      x + half > z.x &&
      x - half < z.x + z.width &&
      y + half > z.y &&
      y - half < z.y + z.height
    );
  }

  private createTechRoomCollisionObjects(): GameObject[] {
    const srcW = 937;
    const srcH = 835;
    const scale = this.mapHeight / srcH;
    const roomW = srcW * scale;
    const overlap = 140 * scale;
    const secondX = roomW - overlap;
    type Rect = { id: string; x: number; y: number; w: number; h: number; prop?: string };
    const rects: Rect[] = [
      // Top labs / consoles
      { id: 'tl_lab', x: 24, y: 34, w: 468, h: 182, prop: 'terminal' },
      { id: 'tr_lab', x: 671, y: 140, w: 232, h: 182, prop: 'terminal' },

      // Mid room tech stations
      { id: 'mid_console_a', x: 430, y: 250, w: 94, h: 78, prop: 'terminal' },
      { id: 'mid_console_b', x: 520, y: 250, w: 94, h: 78, prop: 'terminal' },
      { id: 'mid_console_c', x: 606, y: 250, w: 108, h: 96, prop: 'terminal' },
      { id: 'right_desk_a', x: 666, y: 392, w: 114, h: 94, prop: 'terminal' },
      { id: 'right_desk_b', x: 792, y: 392, w: 112, h: 94, prop: 'terminal' },
      { id: 'right_desk_c', x: 666, y: 544, w: 114, h: 92, prop: 'terminal' },
      { id: 'right_desk_d', x: 792, y: 544, w: 112, h: 92, prop: 'terminal' },

      // Reactor columns / tanks
      { id: 'tank_left_top', x: 242, y: 455, w: 84, h: 125, prop: 'server' },
      { id: 'tank_right_top', x: 444, y: 455, w: 84, h: 125, prop: 'server' },
      { id: 'tank_mid_bottom', x: 332, y: 585, w: 82, h: 117, prop: 'server' },

      // Lower barriers and gate region
      { id: 'bottom_gate_left', x: 205, y: 616, w: 120, h: 85, prop: 'vent' },
      { id: 'bottom_gate_right', x: 421, y: 616, w: 120, h: 85, prop: 'vent' },
      { id: 'bottom_entry_block', x: 614, y: 615, w: 300, h: 102, prop: 'vent' },
    ];

    const objects: GameObject[] = [];
    const sourceInset = 12; // shrink hitboxes so visible open floor is walkable
    for (const r of rects) {
      const insetX = Math.min(sourceInset, Math.max(2, r.w * 0.2));
      const insetY = Math.min(sourceInset, Math.max(2, r.h * 0.2));
      const adjX = r.x + insetX;
      const adjY = r.y + insetY;
      const adjW = Math.max(8, r.w - insetX * 2);
      const adjH = Math.max(8, r.h - insetY * 2);

      // Original room colliders
      objects.push({
        id: `${r.id}-a`,
        x: adjX * scale,
        y: adjY * scale,
        width: adjW * scale,
        height: adjH * scale,
        type: 'furniture',
        color: '#4a5568',
        propType: r.prop,
        isPushable: false,
      });

      // Mirrored continuation colliders
      const mirroredX = secondX + (srcW - (adjX + adjW)) * scale;
      if (mirroredX < this.mapWidth - 40) {
        objects.push({
          id: `${r.id}-b`,
          x: mirroredX,
          y: adjY * scale,
          width: adjW * scale,
          height: adjH * scale,
          type: 'furniture',
          color: '#4a5568',
          propType: r.prop,
          isPushable: false,
        });
      }
    }
    return objects;
  }

  // ===================== ANIMATIONS =====================

  private registerAnimations() {
    for (const id of Object.keys(CHAR_SPRITES)) {
      const idleKey = `idle_${id}_anim`;
      const runKey = `run_${id}_anim`;

      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          // DinoSprites sheet: idle frames 0..3
          frames: this.anims.generateFrameNumbers(`dino_${id}`, { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1,
        });
      }

      if (!this.anims.exists(runKey)) {
        this.anims.create({
          key: runKey,
          // DinoSprites sheet: run frames 4..9
          frames: this.anims.generateFrameNumbers(`dino_${id}`, { start: 4, end: 9 }),
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }

  private setDinoTextureFilter() {
    for (const id of Object.keys(CHAR_SPRITES)) {
      const tex = this.textures.get(`dino_${id}`);
      if (tex) {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    // The grassland sheet (ground + props) — keep it crisp when scaled.
    const enviro = this.textures.get(TS_ENVIRO);
    if (enviro) enviro.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /**
   * Register the exact sub-rect frame for every prop (see PROP_FRAMES) so each can
   * be drawn as one crisp image. Idempotent.
   */
  private registerPropFrames() {
    for (const [name, f] of Object.entries(PROP_FRAMES)) {
      const tex = this.textures.get(f.tex);
      if (!tex || tex.has(name)) continue;
      tex.add(name, 0, f.sx, f.sy, f.sw, f.sh);
    }
  }

  private findTechSpawnPosition(objects: GameObject[], existingPlayers: Player[]): { x: number; y: number } {
    const srcW = 937;
    const srcH = 835;
    const scale = this.mapHeight / srcH;
    const roomW = srcW * scale;
    const overlap = 140 * scale;
    const secondX = roomW - overlap;

    // Curated open-floor anchors (source-image coordinates -> world).
    const leftAnchors = [
      { x: 255, y: 340 },
      { x: 515, y: 365 },
      { x: 705, y: 430 },
      { x: 610, y: 520 },
      { x: 300, y: 545 },
      { x: 470, y: 690 },
    ];
    const anchors: Array<{ x: number; y: number }> = [];
    for (const a of leftAnchors) {
      anchors.push({ x: a.x * scale, y: a.y * scale });
      anchors.push({ x: secondX + (srcW - a.x) * scale, y: a.y * scale });
    }

    // Shuffle anchors for variety.
    const shuffled = [...anchors].sort(() => Math.random() - 0.5);
    for (const p of shuffled) {
      const blocked = checkCollision(p.x, p.y, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight);
      if (blocked) continue;
      const tooClose = existingPlayers.some((ep) => Math.hypot(ep.x - p.x, ep.y - p.y) < 120);
      if (!tooClose) return p;
    }

    return findSafeSpawnPosition(this.mapWidth, this.mapHeight, objects, existingPlayers, 120);
  }

  /** Walkable-ish anchors across stitched inferno panels (for spawns + bot patrol). */
  private getInfernoFloorCandidatePoints(): { x: number; y: number }[] {
    const layout = this.getInfernoLayout();
    if (!layout) return [];
    const { scale1, scale2, width1, width2, overlap } = layout;
    const anchorsFirst = [
      { x: 512, y: 360 },
      { x: 512, y: 480 },
      { x: 400, y: 600 },
      { x: 620, y: 600 },
      { x: 512, y: 720 },
      { x: 512, y: 260 },
      { x: 512, y: 560 },
    ];
    const anchorsSecond = [
      { x: 512, y: 360 },
      { x: 512, y: 500 },
      { x: 360, y: 480 },
      { x: 664, y: 480 },
      { x: 512, y: 220 },
      { x: 512, y: 620 },
      { x: 512, y: 400 },
    ];
    const candidates: { x: number; y: number }[] = [];
    let xOff = 0;
    let useFirst = true;
    while (xOff < this.mapWidth) {
      const sc = useFirst ? scale1 : scale2;
      const anchors = useFirst ? anchorsFirst : anchorsSecond;
      for (const a of anchors) {
        candidates.push({ x: xOff + a.x * sc, y: a.y * sc });
      }
      xOff += (useFirst ? width1 : width2) - overlap;
      useFirst = !useFirst;
    }
    return candidates;
  }

  private findInfernoSpawnPosition(objects: GameObject[], existingPlayers: Player[]): { x: number; y: number } {
    // Inferno is now a plain floor-with-walls tilemap, so the generic safe-spawn
    // (which avoids wall colliders) is all we need; lava pools are walkable.
    return findSafeSpawnPosition(this.mapWidth, this.mapHeight, objects, existingPlayers, 100);
  }

  /**
   * Turn a dino to face its heading. `hx` is the x part of a unit direction.
   *
   * Facing used to follow how far the sprite moved each frame, so anything that nudged
   * it backwards for a frame (the knock-apart on a steal, a bot's unstick slide, a
   * network correction, the sprite catching up) turned the dino around while it ran
   * forwards. Heading comes from intent instead. The dead zone keeps a near-vertical run
   * from flickering left and right, and a dino holds a new facing for at least
   * FACING_HOLD_MS so it can't spin back and forth on the spot.
   */
  private faceToward(id: string, hx: number) {
    const left = hx < -0.2 ? true : hx > 0.2 ? false : null;
    if (left === null || left === (this.facingLeft[id] === true)) return;
    const now = this.time.now;
    if (now - (this.facingAt[id] ?? -Infinity) < FACING_HOLD_MS) return;
    this.facingLeft[id] = left;
    this.facingAt[id] = now;
  }

  private getSpriteId(p: Player): string {
    const ch = characters.find(c => c.id === p.character.id);
    return ch?.spriteId ?? p.character.spriteId ?? 'doux';
  }

  private colorToCss(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  // ===================== SPRITES =====================

  private createObjSprite(obj: GameObject) {
    // Walls/edges are drawn by the tilemap layer itself — only props (objects with
    // an explicit propType mapped in PROP_FRAMES) get a real image drawn on top.
    if (!obj.propType) return;
    const f = PROP_FRAMES[obj.propType];
    if (!f) return;
    // Anchor the art's bottom-centre to the collider's bottom-centre and draw it at
    // WORLD_SCALE, so tall art (tree canopies, house roofs/eaves) overhangs upward
    // while only the base footprint blocks movement.
    const baseX = obj.x + obj.width / 2;
    const baseY = obj.y + obj.height;
    const container = this.add.container(baseX, baseY);
    const shadow = this.add.ellipse(0, -2, Math.max(obj.width * 0.85, 14), Math.max(obj.height * 0.45, 8), 0x000000, 0.18);
    const scale = f.scale ?? WORLD_SCALE;
    const img = this.add.image(0, 0, f.tex, obj.propType).setOrigin(0.5, 1).setScale(scale);
    container.add([shadow, img]);
    container.setDepth(baseY);
    this.objSprites[obj.id] = container;
    const hw = Math.max((f.sw * scale) / 2, obj.width / 2);
    this.cullables.push({ obj: container, x0: baseX - hw, y0: baseY - f.sh * scale, x1: baseX + hw, y1: baseY + obj.height / 2, on: true });
  }

  private createPlayerSprite(p: Player) {
    const container = this.add.container(p.x, p.y);
    const sid = this.getSpriteId(p);

    const shadow = this.add.ellipse(0, 22, 50, 16, 0x000000, 0.3);
    container.add(shadow);

    const spr = this.add.sprite(0, -16, `dino_${sid}`, 0).setName('dino');
    spr.setScale(SPRITE_SCALE);
    spr.setFlipX(this.facingLeft[p.id] === true);
    spr.play(`idle_${sid}_anim`, true);
    if (p.hasEgg) spr.setTint(0xfacc15);
    container.add(spr);

    const nameTag = this.add.text(0, -58, p.character.name, {
      fontSize: '13px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setName('name');
    container.add(nameTag);

    const marker = this.add.text(0, -74, '▼', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setName('marker');
    container.add(marker);

    // Egg-holder badge: a little egg perched on the dino's head so everyone can see
    // who's carrying it at a glance. The sprite is rebuilt on every egg handoff
    // (rebuildPlayerSprite), so this appears/disappears with the egg.
    if (p.hasEgg) {
      const eggShadow = this.add.ellipse(0, -39, 16, 6, 0x000000, 0.25);
      const eggBody = this.add.ellipse(0, -47, 14, 18, 0xfacc15).setStrokeStyle(2, 0x7a5b16, 1);
      const eggGlint = this.add.ellipse(-2.5, -51, 4, 6, 0xfffbeb, 0.7);
      container.add([eggShadow, eggBody, eggGlint]);
    }

    container.setDepth(p.y);
    this.playerSprites[p.id] = container;
  }

  private spawnWorldEgg(x: number, y: number) {
    this.destroyWorldEgg();
    const container = this.add.container(x, y);

    // Halo behind the egg, pulsing on its own timing.
    //
    // The egg is the entire objective and at 26x34 it read as scenery — people watching
    // the game could not tell what anyone was running toward. The halo is tweened
    // separately from the container's bob so the two rhythms don't lock into one motion,
    // which is what makes it catch the eye instead of looking like part of the sprite.
    const glow = this.add.ellipse(0, 0, 64, 64, 0xfacc15, 0.22);
    this.tweens.add({
      targets: glow,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0.05,
      duration: 900,
      ease: 'Sine.Out',
      yoyo: true,
      repeat: -1,
    });

    const shadow = this.add.ellipse(0, 14, 28, 10, 0x000000, 0.35);
    const egg = this.add.ellipse(0, 0, 30, 39, 0xfacc15);
    egg.setStrokeStyle(2, 0xfffbeb, 0.95);
    const highlight = this.add.ellipse(-4, -9, 9, 13, 0xfffbeb, 0.55);
    container.add([glow, shadow, egg, highlight]);
    container.setDepth(y + 50);
    this.tweens.add({
      targets: container,
      y: y - 4,
      duration: 600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    this.eggSprite = container;
  }

  /**
   * Arrow at the screen edge pointing to the egg while it's off-camera.
   *
   * The camera follows the player, so on a map bigger than the viewport the egg is
   * usually somewhere you can't see — leaving new players wandering until they happen
   * upon it. Fixed to the camera (scrollFactor 0) and clamped inside a margin so it
   * rides the edge rather than sliding off with the world.
   */
  private ensureEggArrow(): Phaser.GameObjects.Triangle {
    if (!this.eggArrow) {
      this.eggArrow = this.add
        .triangle(0, 0, 0, -12, 10, 8, -10, 8, 0xfacc15)
        .setStrokeStyle(2, 0x7a5b16, 1)
        .setScrollFactor(0)
        .setDepth(10_000)
        .setVisible(false);
    }
    return this.eggArrow;
  }

  private updateEggArrow() {
    const egg = this.eggSprite;
    const arrow = this.ensureEggArrow();
    // Nothing to point at while someone is carrying it — the holder badge does that job.
    if (!egg) { arrow.setVisible(false); return; }

    const cam = this.cameras.main;
    const view = cam.worldView;
    if (view.contains(egg.x, egg.y)) { arrow.setVisible(false); return; }

    const margin = 44;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    // Direction from the viewport centre to the egg, in screen space.
    const dx = egg.x - (view.x + view.width / 2);
    const dy = egg.y - (view.y + view.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const maxX = cx - margin;
    const maxY = cy - margin;
    // Scale the direction out to whichever edge it reaches first, so the arrow tracks
    // the true bearing instead of snapping to a corner.
    const scale = Math.min(maxX / Math.abs(dx / len), maxY / Math.abs(dy / len));

    arrow
      .setPosition(cx + (dx / len) * scale, cy + (dy / len) * scale)
      .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
      .setVisible(true);
  }

  private destroyWorldEgg() {
    // Hide rather than destroy: the arrow is reused across every pickup and respawn in a
    // round, and killTweensOf on the container doesn't reach the halo's own tween, which
    // the container destroy below takes with it.
    this.eggArrow?.setVisible(false);
    if (this.eggSprite) {
      this.tweens.killTweensOf(this.eggSprite);
      this.eggSprite.each((child: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(child));
      this.eggSprite.destroy();
      this.eggSprite = null;
    }
  }

  private rebuildPlayerSprite(p: Player) {
    const old = this.playerSprites[p.id];
    if (old) old.destroy();
    // The new sprite starts untinted, so drop the cached tint state with it — otherwise
    // the draw loop believes the tint is already applied and the egg carrier silently
    // loses their gold highlight for the rest of the round.
    delete this.spriteTinted[p.id];
    this.createPlayerSprite(p);
  }

  // ===================== GAME LOGIC =====================

  private syncPlayersFromStore() {
    if (this.gameMode !== 'multiplayer') return;
    if (useGameStore.getState().multiplayerHiddenFill) return;
    const storePlayers = useGameStore.getState().players;
    if (!storePlayers || storePlayers.length === 0) return;

    const existingById = new Map(this.gsPlayers.map((p) => [p.id, p]));
    const synced: Player[] = [];

    for (const sp of storePlayers) {
      const existing = existingById.get(sp.id);
      if (existing) {
        // The SCENE is authoritative for every live gameplay field: the local player by
        // input, fill-agents by updateBots on the authority, and remote players/agents by
        // the network handlers — all of which write gsPlayers directly. The store is only a
        // downstream mirror for React. Never feed it back onto the scene, or its stale ~1Hz
        // values clobber live state (powerUpCooldown / powerUpActive / speedBoostActive /
        // isInvincible / x / y) — which is exactly what made MP controls + power-ups feel
        // laggy and "different" from single-player. Adopt ONLY the character (assigned by
        // the lobby, which the scene may not have yet); keep everything else live.
        if (sp.character) existing.character = sp.character;
        synced.push(existing);
      } else {
        const created: Player = {
          ...sp,
          character: sp.character || this.gsPlayers.find((p) => p.id === 'player')?.character || characters[0],
          eggHoldCount: sp.eggHoldCount ?? 0,
          powerUpReady: sp.powerUpReady ?? false,
          powerUpActive: sp.powerUpActive ?? false,
          powerUpCooldown: sp.powerUpCooldown ?? 0,
          isInvincible: sp.isInvincible ?? false,
          speedBoostActive: sp.speedBoostActive ?? false,
        };
        synced.push(created);
        this.createPlayerSprite(created);
      }
    }

    const syncedIds = new Set(synced.map((p) => p.id));
    Object.keys(this.playerSprites).forEach((id) => {
      if (!syncedIds.has(id)) {
        this.playerSprites[id].destroy();
        delete this.playerSprites[id];
        delete this.remoteNet[id];
        // Keep the tint cache in step with the sprites it describes, so a player who
        // leaves and rejoins doesn't inherit a stale entry.
        delete this.spriteTinted[id];
      }
    });

    this.gsPlayers = synced;
  }

  /**
   * Online-multiplayer position sync. Broadcasts the local player's position ~20Hz and
   * applies incoming positions to the matching 'mp-<userId>' player via the store, which
   * the render loop already smoothly interpolates. Listener is bound lazily once the
   * shared socket exists, and torn down on scene shutdown.
   */
  private updateMultiplayerNet(now: number) {
    const socket = getGameSocket();
    if (!socket) return;
    if (!this.netBound) {
      this.netBound = true;
      this.onRemoteInput = (payload: any) => {
        if (!payload || payload.userId == null || payload.userId === this.localUserId) return;
        const id = `mp-${payload.userId}`;
        // Snapshot position + velocity for the render loop's dead-reckoning.
        this.remoteNet[id] = {
          x: payload.x,
          y: payload.y,
          vx: typeof payload.vx === 'number' ? payload.vx : 0,
          vy: typeof payload.vy === 'number' ? payload.vy : 0,
          t: this.time.now,
        };
        // Position feeds the SCENE directly (render dead-reckons from remoteNet; game
        // logic reads gsPlayers) — never through the zustand store, which would re-render
        // React on every 30Hz packet (the choppiness/lag the non-host client suffered).
        const gp = this.gsPlayers.find((p) => p.id === id);
        if (gp) {
          // A big jump is a teleport: snap the sprite rather than slide it across the map.
          if (Math.hypot(payload.x - gp.x, payload.y - gp.y) > 250) this.playerSprites[id]?.setPosition(payload.x, payload.y);
          gp.x = payload.x;
          gp.y = payload.y;
        }
        // Only the shield flag goes to the store/React, and only on change. Egg ownership
        // comes from the server (egg-owner), never from a peer's report.
        this.applyRemoteFlags(id, gp, payload.isInvincible);
      };
      socket.on('player-input', this.onRemoteInput);
      // Egg ownership, decided by the server.
      this.onEggOwner = (payload: any) => this.applyEggOwner(payload);
      socket.on('egg-owner', this.onEggOwner);
      // The server's verdict at the buzzer.
      this.onMatchResult = (payload: any) => {
        if (!payload) return;
        this.matchEnded = true;
        this.resultFallback?.remove(false);
        this.endGame(payload);
      };
      socket.on('match-result', this.onMatchResult);
      // After a reconnect, resync the egg rather than trusting what we last saw.
      this.onRoomRejoined = (payload: any) => { if (payload?.egg) this.applyEggOwner(payload.egg); };
      socket.on('room-rejoined', this.onRoomRejoined);
      // Someone else's power: show it, and feel it if it's an earthquake near us.
      this.onPowerUsed = (payload: any) => this.applyRemotePower(payload);
      socket.on('power-used', this.onPowerUsed);
      // A bot's line, chosen by the bot-steering client.
      this.onBotSaid = (payload: any) => {
        const bot = typeof payload?.uid === 'string' ? this.gsPlayers.find((p) => p.userId === payload.uid) : undefined;
        if (bot && typeof payload.line === 'string') this.showTaunt(bot, payload.line.slice(0, 80));
      };
      socket.on('bot-said', this.onBotSaid);
      // Fill-agent positions, broadcast by the authority. Non-authority clients apply
      // them to the matching 'bot-<i>' (same dead-reckoning path as remote humans).
      this.onAgentState = (payload: any) => {
        if (!payload || !Array.isArray(payload.agents)) return;

        // Hearing anything at all means an authority is alive, which is what suppresses
        // our own failover timer.
        this.lastAgentStateAt = this.time.now;

        if (this.agentAuthority) {
          // Two clients steering at once — possible for a moment after a failover, or if
          // the original authority comes back. Resolve it the same way the initial pick
          // was made: smallest user id wins, so both sides reach the same answer without
          // negotiating. We only ever stand DOWN here; the winner simply keeps going.
          const from = String(payload.from ?? '');
          if (from && from < String(this.localUserId)) {
            this.agentAuthority = false;
            console.info('[agents] lower-ranked peer is steering — standing down');
          } else {
            return; // We hold authority; their positions are not ours to apply.
          }
        }

        for (const a of payload.agents) {
          if (!a || typeof a.id !== 'string') continue;
          this.remoteNet[a.id] = {
            x: a.x, y: a.y,
            vx: typeof a.vx === 'number' ? a.vx : 0,
            vy: typeof a.vy === 'number' ? a.vy : 0,
            t: this.time.now,
          };
          // Same as remote humans: position straight to the scene, store only on flag change.
          if (typeof a.left === 'boolean') this.facingLeft[a.id] = a.left;
          const gp = this.gsPlayers.find((p) => p.id === a.id);
          if (gp) { gp.x = a.x; gp.y = a.y; }
          this.applyRemoteFlags(a.id, gp, a.isInvincible);
        }
      };
      socket.on('agent-state', this.onAgentState);
      this.events.once('shutdown', () => {
        if (this.onRemoteInput) socket.off('player-input', this.onRemoteInput);
        if (this.onEggOwner) socket.off('egg-owner', this.onEggOwner);
        if (this.onMatchResult) socket.off('match-result', this.onMatchResult);
        if (this.onRoomRejoined) socket.off('room-rejoined', this.onRoomRejoined);
        if (this.onPowerUsed) socket.off('power-used', this.onPowerUsed);
        if (this.onBotSaid) socket.off('bot-said', this.onBotSaid);
        if (this.onAgentState) socket.off('agent-state', this.onAgentState);
        this.onRemoteInput = undefined;
        this.onEggOwner = undefined;
        this.onMatchResult = undefined;
        this.onRoomRejoined = undefined;
        this.onPowerUsed = undefined;
        this.onBotSaid = undefined;
        this.onAgentState = undefined;
        this.netBound = false;
      });
    }

    // Authority broadcasts the fill-agents' positions ~30Hz so other clients can render
    // them. Cheap (≤3 bots, volatile) and only one client per room ever sends it.
    if (this.agentAuthority && now - this.lastAgentStateSend >= 33) {
      const bots = this.gsPlayers.filter((p) => p.isBot);
      if (bots.length > 0 && this.roomCode) {
        this.lastAgentStateSend = now;
        socket.volatile.emit('agent-state', {
          roomCode: this.roomCode,
          // Who is steering. Lets a peer that also promoted itself work out which of the
          // two should stand down, with no extra round trip.
          from: this.localUserId,
          agents: bots.map((b) => ({
            id: b.id,
            uid: b.userId,
            x: Math.round(b.x),
            y: Math.round(b.y),
            hasEgg: !!b.hasEgg,
            isInvincible: !!b.isInvincible,
            left: this.facingLeft[b.id] === true,
          })),
        });
      }
    }
    if (now - this.lastNetSend >= 33) {
      this.lastNetSend = now;
      const me = this.gsPlayers.find((p) => p.id === 'player');
      if (me && this.roomCode && this.localUserId) {
        const vel = this.playerVelocity['player'] || { vx: 0, vy: 0 };
        const x = Math.round(me.x);
        const y = Math.round(me.y);
        const vx = Math.round(vel.vx);
        const vy = Math.round(vel.vy);
        const hasEgg = !!me.hasEgg;
        const isInvincible = !!me.isInvincible;

        // Skip identical idle frames: only broadcast when something a remote peer can
        // see has actually changed, or as a ~1Hz keepalive. A still player (vx/vy 0,
        // same position/flags) costs ~1 pkt/s instead of 30 — and since remotes only
        // dead-reckon along the LAST velocity, a stopped peer (vel 0) never drifts.
        const prev = this.lastSent;
        const moving = vx !== 0 || vy !== 0;
        const changed =
          !prev ||
          prev.x !== x || prev.y !== y ||
          prev.vx !== vx || prev.vy !== vy ||
          prev.hasEgg !== hasEgg || prev.isInvincible !== isInvincible;
        const keepalive = !prev || now - prev.t >= 1000;

        if (moving || changed || keepalive) {
          this.lastSent = { x, y, vx, vy, hasEgg, isInvincible, t: now };
          // volatile: a position packet is superseded by the next one, so if this
          // socket's buffer is backed up (slow/stalled peer) drop it rather than
          // queueing — prevents a rubber-band catch-up burst when it recovers.
          socket.volatile.emit('player-input', {
            roomCode: this.roomCode,
            userId: this.localUserId,
            x,
            y,
            // Velocity (px/s) lets remote clients dead-reckon between packets.
            vx,
            vy,
            hasEgg,
            isInvincible,
          });
        }
      }
    }
  }

  /**
   * Push a remote player's shield flag to the store → React, only when it flips.
   * Positions never come through here (see onRemoteInput/onAgentState), so a remote
   * player moving doesn't re-render the React tree 30×/sec.
   */
  private applyRemoteFlags(id: string, gp: Player | undefined, isInvincible: unknown) {
    const patch: Partial<Player> = {};
    if (typeof isInvincible === 'boolean' && gp && gp.isInvincible !== isInvincible) patch.isInvincible = isInvincible;
    if (Object.keys(patch).length === 0) return;
    Object.assign(gp as Player, patch);
    useGameStore.getState().updatePlayer(id, patch);
  }

  /**
   * Match clock, read off the wall clock (see `clockStart`) so it runs at real speed at
   * any frame rate and, online, reads the same on every client.
   * Layout: first 3s = countdown, then GAME_DURATION seconds of play.
   */
  private advanceClock(store: ReturnType<typeof useGameStore.getState>) {
    // Online, re-derive from the server's start time each frame so a refined clock
    // offset takes effect immediately.
    if (this.isOnlineMp && this.serverStartTime) this.clockStart = this.serverStartTime - getServerOffset();
    const elapsed = (Date.now() - this.clockStart) / 1000;

    // Snapshot ~once per second for refresh-resume (mirrors the single-player path).
    const sec = Math.floor(elapsed);
    if (sec !== this.lastClockSec) { this.lastClockSec = sec; this.saveSnapshot(); }

    if (elapsed < 3) {
      this.currentPhase = 'countdown';
      const cd = Math.max(1, Math.ceil(3 - elapsed));
      if (cd !== this.countdownTimer) {
        this.countdownTimer = cd;
        store.setCountdownTimer(cd);
        audioManager.play('beep');
      }
      return;
    }

    // Countdown just finished — flip to play exactly once.
    if (this.currentPhase === 'countdown') {
      this.currentPhase = 'playing';
      this.countdownTimer = 0;
      store.setCountdownTimer(0);
      store.setGamePhase('playing');
      audioManager.play('go');
    }

    const remaining = Math.max(0, Math.ceil(GAME_DURATION - (elapsed - 3)));
    if (remaining !== this.gameTimer) {
      this.gameTimer = remaining;
      store.setTimeRemaining(remaining);
      // The last ten seconds tick, so you can feel the buzzer coming without looking.
      if (remaining > 0 && remaining <= 10) audioManager.play('tick');
      if (remaining === 10) this.voiceFinalCall();
    }
    if (remaining <= 0 && !this.matchEnded) {
      this.matchEnded = true;
      if (this.isOnlineMp) {
        // The server decides who won. Its result normally lands within a few hundred
        // ms; if the connection is gone, fall back to what this client saw.
        this.resultFallback = this.time.delayedCall(3000, () => this.endGame());
      } else {
        this.endGame();
      }
    }
  }

  /**
   * Ask the server to give the egg to `claimerId` (us, or a bot we steer). Nothing
   * changes locally until the server answers with egg-owner, so every client applies the
   * same handoffs in the same order. Throttled per claimer while contact lasts.
   */
  private claimEgg(claimerId: string | undefined) {
    const socket = getGameSocket();
    if (!socket || !this.roomCode || !claimerId) return;
    const now = Date.now();
    if (now - (this.lastClaimAt[claimerId] ?? 0) < 150) return;
    this.lastClaimAt[claimerId] = now;
    const egg = useGameStore.getState().eggPosition;
    socket.emit('egg-claim', {
      roomCode: this.roomCode,
      claimerId,
      eggX: egg ? Math.round(egg.x) : null,
      eggY: egg ? Math.round(egg.y) : null,
    });
  }

  /** Apply the server's egg-owner update, ignoring anything older than what we have. */
  private applyEggOwner(payload: any) {
    if (!payload || typeof payload.seq !== 'number' || payload.seq <= this.eggSeq) return;
    this.eggSeq = payload.seq;
    if (!payload.ownerUserId) return; // still on the ground; nothing to change
    const hadEgg = this.gsPlayers.find((p) => p.hasEgg);
    this.applyEggState(payload.ownerUserId, 0, 0);
    // Grace runs on the server's clock; translate it to ours.
    if (typeof payload.graceUntil === 'number') {
      this.eggGraceUntil = payload.graceUntil - getServerOffset();
    }
    this.lastTagTime = Date.now();
    const holder = this.playerByUserId(payload.ownerUserId);
    if (holder && hadEgg?.id !== holder.id) this.onEggChanged(holder, hadEgg ?? null);
  }

  /**
   * Feedback when the egg changes hands. Big when it's you (you got it / it got taken
   * from you), a light blip when it's between others.
   */
  private onEggChanged(holder: Player, prev: Player | null) {
    const mine = holder.id === 'player';
    const lost = prev?.id === 'player';
    if (mine) {
      audioManager.play('grab');
      buzz('medium');
      this.cameras.main.shake(110, 0.003);
      this.spawnSparkBurst(holder.x, holder.y - 10, 0xfacc15, 16, 110, 380);
      this.spawnPowerLabel(holder, 'GOT IT!', '#ffc93c');
      if (prev) this.hitStopUntil = Date.now() + 70;
    } else if (lost) {
      audioManager.play('stolen');
      buzz('heavy');
      this.cameras.main.shake(220, 0.007);
      this.spawnSparkBurst(prev.x, prev.y - 10, 0xe8503a, 12, 90, 320);
      this.spawnPowerLabel(prev, 'STOLEN!', '#e8503a');
      this.hitStopUntil = Date.now() + 70;
    } else {
      audioManager.play('handoff');
      this.spawnSparkBurst(holder.x, holder.y - 10, 0xfacc15, 10, 70, 260);
    }
    this.voiceEggChange(holder, prev);
  }

  /** Apply a networked egg-ownership change: retint the holder, clear everyone else,
   *  and destroy/respawn the ground egg to match. */
  private applyEggState(ownerUserId: string | null, x: number, y: number) {
    const store = useGameStore.getState();
    // Resolve by userId so it works for humans ('player'/'mp-<id>') AND fill-agents
    // ('bot-<i>', whose userId is 'agent_<i>'). Fall back to the mp- convention.
    const holderId = ownerUserId == null
      ? null
      : (this.gsPlayers.find((p) => p.userId === ownerUserId)?.id
        ?? (ownerUserId === this.localUserId ? 'player' : `mp-${ownerUserId}`));
    for (const p of this.gsPlayers) {
      const should = p.id === holderId;
      if (!!p.hasEgg !== should) {
        p.hasEgg = should;
        if (should) p.eggHoldCount = (p.eggHoldCount || 0) + 1;
        store.updatePlayer(p.id, { hasEgg: should, eggHoldCount: p.eggHoldCount ?? 0 });
        this.rebuildPlayerSprite(p);
      }
    }
    if (holderId) {
      store.setEgg(holderId, null);
      store.setLastEggHolderId(holderId);
      this.destroyWorldEgg();
      this.eggGraceUntil = Date.now() + EGG_GRACE_MS;
    } else {
      store.setEgg(null, { x, y });
      this.spawnWorldEgg(x, y);
    }
  }

  /** The egg can legitimately sit on the floor with no one carrying it, so
   *  there is no "guarantee at least one holder" fallback. Method kept as a
   *  no-op for now since callers may still reference it. */
  private ensureChaserExists() {
    return;
  }

  private updateMovement(dt: number) {
    const human = this.gsPlayers.find(p => p.id === 'player');
    if (!human) return;
    const speedMul = human.speedBoostActive ? 2.5 : 1.0;
    const infernoMul = this.isInInfernoSlowZone(human.x, human.y, PLAYER_SIZE) ? 0.72 : 1;
    const eggMul = human.hasEgg ? EGG_HOLDER_SPEED_MULT : 1;
    const now = Date.now();
    const slowEffectMul = (human.slowedUntil && human.slowedUntil > now) ? 0.3 : 1.0;
    const speedPxPerSec = human.character.speed * 120 * speedMul * infernoMul * eggMul * slowEffectMul;
    let dirX = 0;
    let dirY = 0;

    if (this.gsKeys['w'] || this.gsKeys['arrowup']) dirY -= 1;
    if (this.gsKeys['s'] || this.gsKeys['arrowdown']) dirY += 1;
    if (this.gsKeys['a'] || this.gsKeys['arrowleft']) dirX -= 1;
    if (this.gsKeys['d'] || this.gsKeys['arrowright']) dirX += 1;

    const vel = this.playerVelocity[human.id] || { vx: 0, vy: 0 };
    const hasInput = dirX !== 0 || dirY !== 0;
    let targetVx = 0;
    let targetVy = 0;
    if (hasInput) {
      const len = Math.hypot(dirX, dirY) || 1;
      targetVx = (dirX / len) * speedPxPerSec;
      targetVy = (dirY / len) * speedPxPerSec;
    }

    // Snappier accel/decel so movement feels crisp at the zoomed-in scale.
    const accelBlend = 1 - Math.exp(-26 * dt);
    const dragBlend = 1 - Math.exp(-40 * dt); // Increased friction for stopping faster
    vel.vx = Phaser.Math.Linear(vel.vx, targetVx, hasInput ? accelBlend : dragBlend);
    vel.vy = Phaser.Math.Linear(vel.vy, targetVy, hasInput ? accelBlend : dragBlend);

    /**
     * Move in small steps, sliding along walls rather than stopping dead on them.
     *
     * This used to zero the whole axis on contact (`vel.vx = 0`). Brushing a wall while
     * holding a direction therefore reset that axis every single frame, so the velocity
     * lerp never built past its first step and the player crawled — until they released
     * the keys and let it re-accelerate from clean state. That is the "I'm suddenly
     * running slow and have to let go" bug, and it triggers on any diagonal along
     * geometry, which on a map this size is most of the map.
     *
     * A blocked axis now simply doesn't advance this step, leaving the other axis at
     * full speed: you slide along the wall instead of sticking to it. The per-step offset
     * is recomputed from the live velocity too — it was derived once before the loop, so
     * a mid-loop change had no effect until the next frame.
     */
    const moveX = vel.vx * dt;
    const moveY = vel.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveY)) / 8));
    for (let i = 0; i < steps; i++) {
      const sx = (vel.vx * dt) / steps;
      const sy = (vel.vy * dt) / steps;
      if (!this.getCollidingObject(human.x + sx, human.y, PLAYER_SIZE)) human.x += sx;
      if (!this.getCollidingObject(human.x, human.y + sy, PLAYER_SIZE)) human.y += sy;
    }
    this.playerVelocity[human.id] = vel;

    // Footsteps loop while the local player is actually moving.
    if (hasInput) audioManager.startRunning();
    else audioManager.stopRunning();
  }

  private updateCameraLead(dt: number) {
    const cam = this.cameras.main;
    const human = this.gsPlayers.find((p) => p.id === 'player');
    if (!human || !cam || !this.cameraTarget) return;

    const vel = this.playerVelocity[human.id] || { vx: 0, vy: 0 };
    const speed = Math.hypot(vel.vx, vel.vy);
    const dirX = speed > 1 ? vel.vx / speed : 0;
    const dirY = speed > 1 ? vel.vy / speed : 0;
    const desiredX = human.x + dirX * CAMERA_MAX_LEAD_X;
    const desiredY = human.y + dirY * CAMERA_MAX_LEAD_Y;
    const blend = 1 - Math.exp(-13 * dt);
    this.camTargetX = Phaser.Math.Linear(this.camTargetX, desiredX, blend);
    this.camTargetY = Phaser.Math.Linear(this.camTargetY, desiredY, blend);

    const halfW = cam.width / (2 * cam.zoom);
    const halfH = cam.height / (2 * cam.zoom);
    this.camTargetX = Phaser.Math.Clamp(this.camTargetX, halfW, this.mapWidth - halfW);
    this.camTargetY = Phaser.Math.Clamp(this.camTargetY, halfH, this.mapHeight - halfH);
    this.cameraTarget.setPosition(this.camTargetX, this.camTargetY);
  }

  private getCollidingObject(x: number, y: number, sz: number): GameObject | boolean | null {
    const m = 1;
    if (x - sz / 2 < m || x + sz / 2 > this.mapWidth - m || y - sz / 2 < m || y + sz / 2 > this.mapHeight - m) return true;
    return findCollider(x, y, sz, this.gsObjects);
  }

  /**
   * A bot says something about what just happened. Asks the server's LLM for a line
   * (about a second's budget) and falls back to a canned one for the bot's persona, so
   * bots talk offline too. Rate-limited so they don't talk over each other. Online, the
   * bot-steering client decides the line and shares it with the room.
   */
  private botSay(bot: Player, event: VoiceEvent, target?: string, urgent = false) {
    if (!bot.isBot || (this.isOnlineMp && !this.agentAuthority)) return;
    const now = Date.now();
    if (!urgent && now - this.lastVoiceAt < BOT_VOICE_GAP_MS) return;
    if (now - (this.botVoiceAt[bot.id] ?? 0) < BOT_VOICE_EACH_MS) return;
    this.lastVoiceAt = now;
    this.botVoiceAt[bot.id] = now;

    const show = (line: string) => {
      if (!this.scene.isActive()) return;
      this.showTaunt(bot, line);
      const socket = getGameSocket();
      if (this.isOnlineMp && socket && this.roomCode && bot.userId) {
        socket.emit('bot-said', { roomCode: this.roomCode, uid: bot.userId, line });
      }
    };
    const socket = getGameSocket();
    if (!socket?.connected) { show(cannedLine(bot.persona, event, target)); return; }
    socket.timeout(1300).emit(
      'bot-line',
      {
        roomCode: this.roomCode || `solo-${this.localUserId || 'anon'}`,
        persona: bot.persona,
        event,
        name: bot.character.name,
        target,
        secondsLeft: this.gameTimer,
        holding: !!bot.hasEgg,
      },
      (err: unknown, res?: { line?: string | null }) => {
        show(!err && res?.line ? res.line : cannedLine(bot.persona, event, target));
      },
    );
  }

  private showTaunt(bot: Player, line: string) {
    bot.taunt = line;
    bot.tauntAt = Date.now();
    useGameStore.getState().updatePlayer(bot.id, { taunt: line, tauntAt: bot.tauntAt });
  }

  /** Bot reactions to the egg changing hands. */
  private voiceEggChange(holder: Player, prev: Player | null) {
    if (holder.isBot) this.botSay(holder, prev ? 'steal' : 'grab', prev?.character.name);
    else if (prev?.isBot) this.botSay(prev, 'lost', holder.character.name);
  }

  /** Ten seconds left: whoever has the egg, or the closest bot to it, says something. */
  private voiceFinalCall() {
    if (this.finalCallDone) return;
    this.finalCallDone = true;
    const holder = this.gsPlayers.find((p) => p.hasEgg);
    let speaker: Player | undefined = holder?.isBot ? holder : undefined;
    if (!speaker && holder) {
      let best = Infinity;
      for (const b of this.gsPlayers) {
        if (!b.isBot) continue;
        const d = Math.hypot(b.x - holder.x, b.y - holder.y);
        if (d < best) { best = d; speaker = b; }
      }
    }
    if (speaker) this.botSay(speaker, 'final', holder?.character.name, true);
  }

  /** Push a throttled snapshot of world positions to the store for the minimap.
   *  ~12Hz keeps the blips smooth without flooding React with re-renders. */
  private updateMinimap(now: number) {
    if (now - this.lastMinimap < 80) return;
    this.lastMinimap = now;
    const personaColor: Record<string, string> = {
      aggressive: '#f87171', sneaky: '#a78bfa', cocky: '#fb923c', cautious: '#5fcde4',
    };
    const dots: MinimapDot[] = this.gsPlayers.map((p) => ({
      x: p.x,
      y: p.y,
      // Egg carrier = gold; you = green; agents = persona-tinted; other humans = white.
      color: p.hasEgg ? '#facc15' : p.id === 'player' ? '#4ade80' : p.isBot ? (personaColor[p.persona ?? ''] ?? '#fbbf24') : '#ffffff',
      kind: p.id === 'player' ? 'self' : p.isBot ? 'agent' : 'human',
    }));
    const egg = useGameStore.getState().eggPosition;
    if (egg) dots.push({ x: egg.x, y: egg.y, color: '#facc15', kind: 'egg' });
    useGameStore.getState().setMinimap({ w: this.mapWidth, h: this.mapHeight, dots });
  }

  private updateBots(dt: number) {
    // In online MP only the agent-authority steers the fill-agents; everyone else
    // renders them off the broadcast (updateMultiplayerNet → agent-state). Single-
    // player / hidden-fill always own their bots (agentAuthority defaults true there).
    if (this.isOnlineMp && !this.agentAuthority) return;
    const bots = this.gsPlayers.filter((p) => p.isBot);
    if (bots.length === 0) return;

    const tuning = TUNING[this.difficulty];
    const progress = 1 - Math.max(0, Math.min(1, this.gameTimer / GAME_DURATION));
    const speedRamp = ramp(tuning.speed, progress);
    const lead = ramp(tuning.lead, progress);
    const now = Date.now();
    const holder = this.gsPlayers.find((p) => p.hasEgg) ?? null;
    const eggPos = useGameStore.getState().eggPosition;

    // Re-read the situation at the difficulty's reaction speed.
    if (now - this.lastRoleAt >= tuning.reactionMs) {
      this.lastRoleAt = now;
      const roles = assignRoles(
        {
          bots: bots.map((b) => ({ id: b.id, x: b.x, y: b.y })),
          holder: holder ? { id: holder.id, x: holder.x, y: holder.y, isBot: holder.isBot } : null,
          egg: holder ? null : eggPos,
        },
        tuning.teamwork,
      );
      for (const b of bots) {
        const role = roles.get(b.id) ?? 'roam';
        const mind = this.mindOf(b);
        if (mind.role !== role) { mind.role = role; mind.aimAt = 0; }
        // The HUD bots panel shows the tactic; only touch the store when it changes.
        if (b.aiIntent?.mode !== role) {
          const intent = { ...(b.aiIntent ?? {}), agentId: b.id, mode: role };
          b.aiIntent = intent;
          useGameStore.getState().updatePlayer(b.id, { aiIntent: intent });
        }
      }
    }

    // How close a direct hunter switches from its (possibly stale) aim point to the
    // target itself. Easy bots commit to where you were and overshoot.
    const lockOn = this.difficulty === 'easy' ? 45 : this.difficulty === 'hard' ? 130 : 90;

    for (const bot of bots) {
      const mind = this.mindOf(bot);
      const speedMul = bot.speedBoostActive ? 2.5 : 1.0;
      const slowMul = bot.slowedUntil && bot.slowedUntil > now ? 0.3 : 1.0;
      // Holder is slower (target); hunters are faster (so they can close the gap).
      const baseMult = bot.hasEgg ? BOT_SPEED_HOLDER : BOT_SPEED_HUNTER;
      const personaMul = PERSONA_SPEED[bot.persona ?? 'sneaky'] ?? 1;
      const pxPerSec = bot.character.speed * baseMult * speedMul * slowMul * personaMul * speedRamp;
      const speed = pxPerSec * dt;

      if (bot.hasEgg) {
        this.fleeFrom(bot, speed);
      } else {
        if (!mind.aim || now - mind.aimAt >= tuning.reactionMs) {
          mind.aim = this.aimFor(bot, mind.role, holder, eggPos, pxPerSec, lead);
          mind.aimAt = now;
        }
        let aim = mind.aim;
        if (holder && !holder.isInvincible && holder.id !== bot.id && mind.role === 'hunt'
          && Math.hypot(holder.x - bot.x, holder.y - bot.y) < lockOn) {
          aim = { x: holder.x, y: holder.y };
          // "Right behind you" lines: sometimes, and rarely from the same bot.
          if (!holder.isBot && now - (this.botCloseAt[bot.id] ?? 0) > 15_000 && Math.random() < 0.02) {
            this.botCloseAt[bot.id] = now;
            this.botSay(bot, 'close', holder.character.name);
          }
        }
        if (aim) this.moveTowards(bot, aim.x, aim.y, speed);
        else this.wander(bot, speed);
      }

      this.maybeUsePower(bot, tuning, holder);
      this.trackBotVelocity(bot, dt);

      const st = this.botStuckAccum[bot.id] || { x: bot.x, y: bot.y, t: 0 };
      const movedBit = Math.hypot(bot.x - st.x, bot.y - st.y);
      if (movedBit < 1.8) st.t += dt;
      else {
        st.t = 0;
        st.x = bot.x;
        st.y = bot.y;
      }
      if (st.t > 2.1) {
        const others = this.gsPlayers.filter((p) => p.id !== bot.id);
        const rescue = findSafeSpawnPosition(this.mapWidth, this.mapHeight, this.gsObjects, others, 70);
        bot.x = rescue.x;
        bot.y = rescue.y;
        bot.targetX = undefined;
        bot.targetY = undefined;
        mind.aim = null;
        st.t = 0;
        st.x = bot.x;
        st.y = bot.y;
        this.botLastPos[bot.id] = { x: bot.x, y: bot.y };
        useGameStore.getState().updatePlayer(bot.id, { x: bot.x, y: bot.y });
      } else if (st.t > 1.05) {
        this.tryBotSlideOutOfCorner(bot);
        mind.aim = null;
        st.t = 0.55;
        st.x = bot.x;
        st.y = bot.y;
      } else if (st.t > 0.42) {
        bot.targetX = undefined;
        bot.targetY = undefined;
      }
      this.botStuckAccum[bot.id] = st;
    }
  }

  private mindOf(bot: Player): { role: Role; aim: { x: number; y: number } | null; aimAt: number } {
    let mind = this.botMind[bot.id];
    if (!mind) {
      mind = { role: 'roam', aim: null, aimAt: 0 };
      this.botMind[bot.id] = mind;
    }
    return mind;
  }

  /** Holding the egg always means run: away from the nearest threat, harder the closer it is. */
  private fleeFrom(bot: Player, speed: number) {
    const threats = this.gsPlayers.filter((p) => p.id !== bot.id && !p.isInvincible);
    if (threats.length === 0) { this.wander(bot, speed); return; }
    let nearest = threats[0];
    let minD = Math.hypot(bot.x - nearest.x, bot.y - nearest.y);
    for (const p of threats) {
      const d = Math.hypot(bot.x - p.x, bot.y - p.y);
      if (d < minD) { minD = d; nearest = p; }
    }
    const push = CHASE_FLEE_PUSH + (1 - Math.min(minD, CHASE_FLEE_RADIUS) / CHASE_FLEE_RADIUS) * 0.9;
    this.moveTowards(bot, bot.x + (bot.x - nearest.x) * push, bot.y + (bot.y - nearest.y) * push, speed);
  }

  /** Where this bot should head for its role right now. Null means wander. */
  private aimFor(
    bot: Player,
    role: Role,
    holder: Player | null,
    egg: { x: number; y: number } | null,
    pxPerSec: number,
    lead: number,
  ): { x: number; y: number } | null {
    if (holder && holder.id !== bot.id) {
      const dx = holder.x - bot.x;
      const dy = holder.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      // Shielded holder can't be tagged: stalk just outside reach, ready for it to drop.
      if (holder.isInvincible) {
        const keep = 130;
        return d <= keep ? { x: bot.x, y: bot.y } : { x: holder.x - (dx / d) * keep, y: holder.y - (dy / d) * keep };
      }
      if (role === 'intercept') return this.interceptPoint(bot, holder, pxPerSec, lead);
      if (role === 'guard') {
        // Cover the lane the holder is running into, or the side away from the nearest
        // other chaser if they're standing still.
        const v = this.velocityOf(holder);
        const sp = Math.hypot(v.vx, v.vy);
        let ex = 0, ey = 0;
        if (sp > 40) { ex = v.vx / sp; ey = v.vy / sp; }
        else {
          const others = this.gsPlayers.filter((p) => p.id !== holder.id && p.id !== bot.id);
          let near: Player | null = null;
          let nd = Infinity;
          for (const o of others) {
            const od = Math.hypot(o.x - holder.x, o.y - holder.y);
            if (od < nd) { nd = od; near = o; }
          }
          if (near && nd > 1) { ex = (holder.x - near.x) / nd; ey = (holder.y - near.y) / nd; }
          else { ex = -dx / d; ey = -dy / d; }
        }
        const reach = 150 + 120 * lead;
        return this.clampToArena(holder.x + ex * reach, holder.y + ey * reach);
      }
      return this.interceptPoint(bot, holder, pxPerSec, lead * 0.5);
    }
    if (egg) {
      if (role === 'guard') {
        // Body-block: stand between the egg and whoever else is closest to it.
        let near: Player | null = null;
        let nd = Infinity;
        for (const o of this.gsPlayers) {
          if (o.id === bot.id) continue;
          const od = Math.hypot(o.x - egg.x, o.y - egg.y);
          if (od < nd) { nd = od; near = o; }
        }
        if (near && nd > 1) return this.clampToArena(egg.x + ((near.x - egg.x) / nd) * 70, egg.y + ((near.y - egg.y) / nd) * 70);
      }
      return { x: egg.x, y: egg.y };
    }
    return null;
  }

  /** Power-up use per difficulty: rare random presses, random presses, or when it helps. */
  private maybeUsePower(bot: Player, tuning: BotTuning, holder: Player | null) {
    if (!bot.powerUpReady || bot.powerUpActive || bot.powerUpCooldown) return;
    if (tuning.powers !== 'smart') {
      // Holder leans more often on its power-up (defensive); hunters less so.
      const base = bot.hasEgg ? 0.014 : 0.009;
      if (Math.random() < (tuning.powers === 'rare' ? base * 0.3 : base)) this.activatePowerUp(bot);
      return;
    }
    const type = bot.character.powerUp.type;
    if (bot.hasEgg) {
      let threat = Infinity;
      for (const p of this.gsPlayers) {
        if (p.id === bot.id || p.isInvincible) continue;
        threat = Math.min(threat, Math.hypot(p.x - bot.x, p.y - bot.y));
      }
      const use =
        (type === 'shield' && threat < 90) ||
        (type === 'earthquake' && threat < 200) ||
        (type === 'speed-boost' && threat < 170) ||
        (type === 'teleport' && threat < 80);
      if (use) this.activatePowerUp(bot);
      return;
    }
    if (!holder || holder.isInvincible) return;
    const d = Math.hypot(holder.x - bot.x, holder.y - bot.y);
    const use =
      (type === 'speed-boost' && d < 280 && d > 60) ||
      (type === 'earthquake' && d < 220) ||
      (type === 'teleport' && d > 450);
    // A shield on a chaser only stops it from tagging, so it's never worth it.
    if (use) this.activatePowerUp(bot);
  }

  /** Velocity in px/s for anyone: input for you, network for remote players, observed for bots. */
  private velocityOf(p: Player): { vx: number; vy: number } {
    if (p.id === 'player') return this.playerVelocity['player'] ?? { vx: 0, vy: 0 };
    const net = this.remoteNet[p.id];
    if (net) return { vx: net.vx, vy: net.vy };
    return this.botVel[p.id] ?? { vx: 0, vy: 0 };
  }

  private trackBotVelocity(bot: Player, dt: number) {
    const prev = this.botLastPos[bot.id];
    this.botLastPos[bot.id] = { x: bot.x, y: bot.y };
    if (!prev || dt <= 0) return;
    let vx = (bot.x - prev.x) / dt;
    let vy = (bot.y - prev.y) / dt;
    const sp = Math.hypot(vx, vy);
    if (sp > 900) { vx = (vx / sp) * 900; vy = (vy / sp) * 900; } // teleports, rescues
    const old = this.botVel[bot.id] ?? { vx: 0, vy: 0 };
    this.botVel[bot.id] = { vx: old.vx + (vx - old.vx) * 0.3, vy: old.vy + (vy - old.vy) * 0.3 };
  }

  /** Keep aim points inside the hedge ring so bots don't run into it chasing a projection. */
  private clampToArena(x: number, y: number): { x: number; y: number } {
    const m = this.arenaInset;
    return {
      x: Math.max(m, Math.min(this.mapWidth - m, x)),
      y: Math.max(m, Math.min(this.mapHeight - m, y)),
    };
  }

  private wander(bot: Player, speed: number) {
    const close = !bot.targetX || !bot.targetY || Math.hypot(bot.x - bot.targetX, bot.y - bot.targetY) < 42;
    if (close) {
      // Pick a random open point in the forest (retry a few times to dodge trees/bushes).
      let picked = false;
      for (let t = 0; t < 8 && !picked; t++) {
        const jx = Math.random() * (this.mapWidth - 120) + 60;
        const jy = Math.random() * (this.mapHeight - 120) + 60;
        if (!checkCollision(jx, jy, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          bot.targetX = jx; bot.targetY = jy; picked = true;
        }
      }
      if (!picked) {
        const fb = findSafeSpawnPosition(this.mapWidth, this.mapHeight, this.gsObjects, this.gsPlayers.filter((p) => p.id !== bot.id), 70);
        bot.targetX = fb.x; bot.targetY = fb.y;
      }
    }
    this.moveTowards(bot, bot.targetX!, bot.targetY!, speed);
  }

  /** Nudge bots away from tight corners (inferno furniture gaps). */
  private tryBotSlideOutOfCorner(bot: Player) {
    const step = 24;
    const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
    for (const a of angles) {
      const nx = bot.x + Math.cos(a) * step;
      const ny = bot.y + Math.sin(a) * step;
      if (!checkCollision(nx, ny, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
        bot.x = nx;
        bot.y = ny;
        return;
      }
    }
  }

  /**
   * Proactive obstacle avoidance for bots: if the path straight ahead is blocked,
   * rotate the heading to the nearest open angle so the bot flows around walls and
   * through doorways instead of jamming. Returns a unit direction.
   */
  private steerAround(player: Player, ux: number, uy: number): { x: number; y: number } {
    const near = PLAYER_SIZE * 1.7, far = PLAYER_SIZE * 3.4;
    const clearAt = (dirx: number, diry: number, d: number) =>
      !checkCollision(player.x + dirx * d, player.y + diry * d, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight);
    // Straight ahead is clear all the way — go for it.
    if (clearAt(ux, uy, near) && clearAt(ux, uy, far)) return { x: ux, y: uy };
    const base = Math.atan2(uy, ux);
    // Scan from a small deflection outward to ~135°, nearest first. Prefer an angle
    // that is open BOTH near and far (a real lane / doorway); otherwise take the
    // first that at least clears the near step so the bot keeps flowing.
    const offsets = [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.55, -1.55, 1.95, -1.95, 2.35, -2.35];
    let nearFallback: { x: number; y: number } | null = null;
    for (const off of offsets) {
      const a = base + off;
      const cx = Math.cos(a), cy = Math.sin(a);
      if (!clearAt(cx, cy, near)) continue;
      if (clearAt(cx, cy, far)) return { x: cx, y: cy };
      if (!nearFallback) nearFallback = { x: cx, y: cy };
    }
    return nearFallback ?? { x: ux, y: uy };
  }

  /**
   * Where to aim to cut a moving target off, instead of trailing it.
   *
   * Aims at where the target will be by the time the bot could get there: target
   * velocity (px/s) times the bot's travel time (s), capped at 1.2s so a slow bot doesn't
   * extrapolate a straight line far past any turn. `strength` scales the lead: 0 aims at
   * the target, 1 is the full intercept.
   *
   * This used to multiply a px/s velocity by a frame count, so every aim point landed
   * thousands of pixels ahead of a moving player and bots ran parallel to you toward the
   * map edge instead of cutting you off. Remote players had no velocity at all.
   */
  private interceptPoint(bot: Player, target: Player, botPxPerSec: number, strength = 1): { x: number; y: number } {
    const tv = this.velocityOf(target);
    const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
    const t = Math.min(dist / Math.max(botPxPerSec, 1), 1.2) * strength;
    const ax = target.x + tv.vx * t;
    const ay = target.y + tv.vy * t;

    /**
     * Fan the pursuers out so they surround instead of stacking. Each bot gets a stable
     * lateral offset from its id, applied perpendicular to its approach and shrinking to
     * zero on contact, so they arc in from different sides and still close for the tag.
     */
    const dx = ax - bot.x;
    const dy = ay - bot.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return this.clampToArena(ax, ay);
    let h = 0;
    for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) | 0;
    const side = ((h % 1000) / 500) - 1;
    const lateral = Math.min(d * 0.4, 130) * side;
    return this.clampToArena(ax + (-dy / d) * lateral, ay + (dx / d) * lateral);
  }

  private moveTowards(player: Player, tx: number, ty: number, speed: number) {
    const dx = tx - player.x,
      dy = ty - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) return;
    let ux = dx / dist, uy = dy / dist;
    if (player.isBot) {
      // 1. Separation / Flocking Force (prevents bot stacking/orgy)
      let sepX = 0, sepY = 0, sepCount = 0;
      this.gsPlayers.forEach(other => {
        if (other.id !== player.id && other.isBot && !other.hasEgg) {
          const ox = player.x - other.x;
          const oy = player.y - other.y;
          const odist = Math.hypot(ox, oy);
          if (odist > 0 && odist < 140) {
            const force = (140 - odist) / 140;
            sepX += (ox / odist) * force;
            sepY += (oy / odist) * force;
            sepCount++;
          }
        }
      });
      if (sepCount > 0) {
        // Blend target chase direction with separation push
        const blendedX = ux * 1.0 + sepX * 1.8;
        const blendedY = uy * 1.0 + sepY * 1.8;
        const blendedMag = Math.hypot(blendedX, blendedY);
        if (blendedMag > 0) {
          ux = blendedX / blendedMag;
          uy = blendedY / blendedMag;
        }
      }

      // 2. Obstacle Avoidance Steering
      const steered = this.steerAround(player, ux, uy);
      ux = steered.x;
      uy = steered.y;
      // Smoothed: right on top of its target a bot's heading swings side to side every
      // frame, and facing that raw would spin the sprite.
      const hx = (this.botHeadX[player.id] ?? ux) * 0.85 + ux * 0.15;
      this.botHeadX[player.id] = hx;
      this.faceToward(player.id, hx);
    }
    const actualSpeed = Math.max(speed, player.isBot ? 5.5 : 0);
    const nx = player.x + ux * actualSpeed;
    const ny = player.y + uy * actualSpeed;

    const steps = Math.max(1, Math.ceil(actualSpeed / 6));
    const sx = (nx - player.x) / steps;
    const sy = (ny - player.y) / steps;
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const txStep = player.x + sx;
      const tyStep = player.y + sy;
      if (!checkCollision(txStep, player.y, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
        player.x = txStep;
        moved = true;
      }
      if (!checkCollision(player.x, tyStep, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
        player.y = tyStep;
        moved = true;
      }
    }
    if (!moved && player.isBot) {
      const len = dist || 1;
      const ux = (dx / len) * actualSpeed;
      const uy = (dy / len) * actualSpeed;
      const px = -uy * 0.92;
      const py = ux * 0.92;
      const slideTries: [number, number][] = [
        [ux, 0],
        [0, uy],
        [-ux * 0.85, 0],
        [0, -uy * 0.85],
        [px, py],
        [-px, -py],
        [px * 0.6, uy * 0.6],
        [ux * 0.6, py * 0.6],
      ];
      for (const [ex, ey] of slideTries) {
        if (!checkCollision(player.x + ex, player.y + ey, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          player.x += ex;
          player.y += ey;
          moved = true;
          break;
        }
      }
    }
    if (!moved && player.isBot) {
      player.targetX = undefined;
      player.targetY = undefined;
    }
  }

  /**
   * Online egg handling. Clients never hand the egg over themselves: when we see contact
   * (us with the ground egg or its holder, or, on the bot-steering client, a bot with
   * either) we claim it, and the server's egg-owner broadcast makes the change on every
   * screen at once. See server/src/match.ts.
   */
  private updateTaggingMp() {
    const store = useGameStore.getState();
    const now = Date.now();
    const tagDist = Math.max(TAG_DISTANCE, PLAYER_SIZE * 2.2);
    const holder = this.gsPlayers.find((p) => p.hasEgg);
    const eggPos = holder ? null : store.eggPosition;
    const canSteal = now >= this.eggGraceUntil && now - this.lastTagTime >= TAG_COOLDOWN;

    const tryClaim = (p: Player) => {
      if (p.isInvincible || p.hasEgg) return;
      if (eggPos) {
        if (Math.hypot(p.x - eggPos.x, p.y - eggPos.y) <= tagDist) this.claimEgg(p.id === 'player' ? this.localUserId : p.userId);
        return;
      }
      if (!holder || holder.isInvincible || !canSteal) return;
      if (Math.hypot(holder.x - p.x, holder.y - p.y) <= tagDist) this.claimEgg(p.id === 'player' ? this.localUserId : p.userId);
    };

    const me = this.gsPlayers.find((p) => p.id === 'player');
    if (me) tryClaim(me);
    // The bot-steering client claims for the bots.
    if (this.agentAuthority) for (const b of this.gsPlayers) if (b.isBot) tryClaim(b);
  }

  private updateTagging() {
    // Online multiplayer has authoritative, networked egg ownership — handle it apart
    // from the local bot sim so the egg can't desync between clients.
    if (this.isOnlineMp) { this.updateTaggingMp(); return; }

    const store = useGameStore.getState();
    const now = Date.now();
    const effectiveTagDistance = Math.max(TAG_DISTANCE, PLAYER_SIZE * 2.2);

    // 1) PICKUP — egg sits on the ground; first player within range grabs it.
    if (!this.gsPlayers.some((p) => p.hasEgg)) {
      const eggPos = store.eggPosition;
      if (eggPos) {
        for (const p of this.gsPlayers) {
          if (p.isInvincible) continue;
          if (Math.hypot(p.x - eggPos.x, p.y - eggPos.y) <= effectiveTagDistance) {
            p.hasEgg = true;
            p.eggHoldCount = (p.eggHoldCount || 0) + 1;
            store.updatePlayer(p.id, { hasEgg: true, eggHoldCount: p.eggHoldCount });
            store.setEgg(p.id, null);
            store.setLastEggHolderId(p.id);
            this.destroyWorldEgg();
            this.lastTagTime = now;
            this.eggGraceUntil = now + EGG_GRACE_MS;
            this.rebuildPlayerSprite(p);
            this.onEggChanged(p, null);
            break;
          }
        }
      }
      return;
    }

    // 2) TRANSFER — someone holds the egg; non-holders try to take it on contact.
    // Keep-away grace: the fresh holder is steal-proof for a beat so they can break
    // away, instead of the egg ping-ponging the instant the cooldown expires.
    if (now < this.eggGraceUntil) return;
    if (now - this.lastTagTime < TAG_COOLDOWN) return;
    if (this.tagBackBlock && now >= this.tagBackBlock.until) this.tagBackBlock = null;

    const holder = this.gsPlayers.find((p) => p.hasEgg);
    if (!holder) return;
    // If the holder has an active invincibility shield, nobody can touch them
    if (holder.isInvincible) return;
    const others = this.gsPlayers.filter((p) => !p.hasEgg && !p.isInvincible);

    for (const target of others) {
      // Same-frame retake protection: previous holder can't instantly snatch back.
      if (
        this.tagBackBlock &&
        now < this.tagBackBlock.until &&
        holder.id === this.tagBackBlock.newChaserId &&
        target.id === this.tagBackBlock.prevChaserId
      ) {
        continue;
      }
      const dist = Math.hypot(holder.x - target.x, holder.y - target.y);
      if (dist <= effectiveTagDistance) {
        // Knock the players apart so the new holder gets a moment of breathing room.
        const angle = Math.atan2(holder.y - target.y, holder.x - target.x);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const pushHolder = 50; // Reduced knockback to prevent clipping and feeling jarring
        const pullChallenger = 10;
        let hx = holder.x + cos * pushHolder;
        let hy = holder.y + sin * pushHolder;
        if (checkCollision(hx, hy, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          hx = holder.x + cos * 70;
          hy = holder.y + sin * 70;
        }
        let tx = target.x - cos * pullChallenger;
        let ty = target.y - sin * pullChallenger;
        if (checkCollision(tx, ty, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          tx = target.x;
          ty = target.y;
        }
        if (!checkCollision(hx, hy, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          holder.x = hx;
          holder.y = hy;
        }
        if (!checkCollision(tx, ty, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          target.x = tx;
          target.y = ty;
        }

        // Hand off the egg.
        holder.hasEgg = false;
        target.hasEgg = true;
        target.eggHoldCount = (target.eggHoldCount || 0) + 1;
        store.updatePlayer(holder.id, { hasEgg: false, x: holder.x, y: holder.y });
        store.updatePlayer(target.id, { hasEgg: true, x: target.x, y: target.y, eggHoldCount: target.eggHoldCount });
        store.setEgg(target.id, null);
        store.setLastEggHolderId(target.id);
        this.lastTagTime = now;
        this.eggGraceUntil = now + EGG_GRACE_MS;
        this.tagBackBlock = {
          newChaserId: target.id,
          prevChaserId: holder.id,
          until: now + TAG_BACK_BLOCK_MS,
        };

        this.rebuildPlayerSprite(holder);
        this.rebuildPlayerSprite(target);
        this.onEggChanged(target, holder);
        break;
      }
    }
  }

  private spawnPulse(
    x: number,
    y: number,
    color: number,
    fromRadius = 22,
    toRadius = 90,
    alpha = 0.5,
    duration = 320
  ) {
    const pulse = this.add
      .circle(x, y, fromRadius, color, alpha)
      .setDepth(y + 200);
    pulse.setStrokeStyle(2, color, alpha);
    this.tweens.add({
      targets: pulse,
      radius: toRadius,
      alpha: 0,
      duration,
      ease: 'Cubic.Out',
      onComplete: () => pulse.destroy(),
    });
  }

  private attachPowerAura(playerId: string, color: number) {
    this.removePowerAura(playerId);
    const sprite = this.playerSprites[playerId];
    if (!sprite) return;
    const aura = this.add
      .circle(0, -12, 28, color, 0.22)
      .setStrokeStyle(3, color, 0.85);
    sprite.addAt(aura, 1);
    this.tweens.add({
      targets: aura,
      scale: { from: 0.9, to: 1.12 },
      alpha: { from: 0.45, to: 0.15 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.powerUpAuras[playerId] = aura;
  }

  private removePowerAura(playerId: string) {
    const aura = this.powerUpAuras[playerId];
    if (!aura) return;
    aura.destroy();
    delete this.powerUpAuras[playerId];
  }

  private spawnSpeedGhost(player: Player, color: number) {
    const ghost = this.add
      .circle(player.x, player.y - 12, 14, color, 0.3)
      .setDepth(player.y - 1);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 1.7,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => ghost.destroy(),
    });
  }

  private spawnPowerLabel(player: Player, text: string, color: string) {
    const label = this.add
      .text(player.x, player.y - 74, text, {
        fontSize: '16px',
        fontFamily: 'Arial Black',
        color,
        stroke: '#04111f',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(player.y + 260);
    this.tweens.add({
      targets: label,
      y: player.y - 108,
      alpha: 0,
      duration: 520,
      ease: 'Sine.Out',
      onComplete: () => label.destroy(),
    });
  }

  private spawnSparkBurst(
    x: number,
    y: number,
    color: number,
    count = 12,
    maxRadius = 110,
    duration = 340
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = Phaser.Math.FloatBetween(maxRadius * 0.55, maxRadius);
      const spark = this.add
        .circle(x, y, Phaser.Math.FloatBetween(2.5, 4.2), color, 0.85)
        .setDepth(y + 220);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.35,
        duration,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private updatePowerUps(_dt: number) {
    const elapsed = Date.now() - this.gameStartTime;
    const deltaMs = _dt * 1000;
    this.gsPlayers.forEach((p) => {
      // Active-effect lifetime — dt-based, so it advances only while playing (pauses
      // with the menu) and never gets dropped by background-tab timer throttling.
      // This is the fix for power-ups "getting stuck" active forever.
      if (p.powerUpActive) {
        p.powerUpActiveMs = (p.powerUpActiveMs ?? 0) - deltaMs;
        if (p.powerUpActiveMs <= 0) this.deactivatePowerUp(p);
      }

      // Keep initial power-up lock until global unlock time.
      if (elapsed < POWER_UP_UNLOCK_TIME_MS) {
        return;
      }

      const cooldown = p.powerUpCooldown ?? 0;
      if (cooldown > 0) {
        const nextCooldown = Math.max(0, cooldown - deltaMs);
        const becameReady = nextCooldown <= 0;
        p.powerUpCooldown = nextCooldown;
        if (becameReady) {
          p.powerUpReady = true;
        }
        const secA = Math.ceil(cooldown / 1000);
        const secB = Math.ceil(nextCooldown / 1000);
        if (becameReady || secA !== secB) {
          useGameStore.getState().updatePlayer(p.id, {
            powerUpCooldown: nextCooldown,
            powerUpReady: becameReady ? true : p.powerUpReady,
          });
        }
        return;
      }

      if (!p.powerUpReady && !p.powerUpActive) {
        p.powerUpReady = true;
        useGameStore.getState().updatePlayer(p.id, { powerUpReady: true, powerUpCooldown: 0 });
      }
    });
  }

  /**
   * Power-up reload cadence shortens as the clock winds down so the endgame gets
   * frantic: 15s for most of the match, 10s in the last minute, 5s in the last 30s.
   */
  private powerUpReloadMs(): number {
    if (this.gameTimer <= 30) return 5000;
    if (this.gameTimer <= 60) return 10000;
    return 15000;
  }

  private activatePowerUp(player: Player) {
    if (!player.powerUpReady || player.powerUpActive || player.powerUpCooldown) return;
    const pu = player.character.powerUp;
    player.powerUpActive = true;
    player.powerUpReady = false;
    const reloadMs = this.powerUpReloadMs();
    player.powerUpCooldown = reloadMs;
    player.powerUpCooldownMax = reloadMs;
    // Active-effect lifetime is counted down by updatePowerUps (dt-based), so it
    // can never get stuck on pause or background-tab setTimeout throttling.
    player.powerUpActiveMs = pu.type === 'teleport' ? 650 : pu.duration;
    const store = useGameStore.getState();
    store.updatePlayer(player.id, {
      powerUpActive: true,
      powerUpReady: false,
      powerUpCooldown: reloadMs,
      powerUpCooldownMax: reloadMs,
    });

    const baseColor =
      pu.type === 'speed-boost'
        ? 0x38bdf8
        : pu.type === 'earthquake'
        ? 0xf97316
        : pu.type === 'shield'
        ? 0x22c55e
        : pu.type === 'teleport'
        ? 0xa78bfa
        : 0xffffff;
    audioManager.play('power-use');
    if (player.id === 'player') buzz('light');
    this.broadcastPower(player, pu.type);
    this.spawnPulse(player.x, player.y, baseColor, 24, 76, 0.5, 260);
    this.spawnSparkBurst(player.x, player.y, baseColor, 8, 72, 260);
    this.spawnPowerLabel(player, pu.name.toUpperCase(), '#dbeafe');

    switch (pu.type) {
      case 'speed-boost':
        this.attachPowerAura(player.id, 0x38bdf8);
        player.speedBoostActive = true;
        // Self-terminating cosmetic trail (stops when speedBoostActive clears).
        this.time.addEvent({
          delay: 70,
          repeat: Math.floor(pu.duration / 70),
          callback: () => {
            if (player.speedBoostActive) {
              this.spawnSpeedGhost(player, 0x38bdf8);
              this.spawnSparkBurst(player.x, player.y - 10, 0x38bdf8, 4, 30, 180);
            }
          },
        });
        // Deactivation handled by updatePowerUps (dt-based) — see deactivatePowerUp.
        break;
      case 'earthquake':
        this.cameras.main.shake(pu.duration, 0.005);
        this.spawnPulse(player.x, player.y, 0xf97316, 40, 180, 0.5, pu.duration);
        this.spawnSparkBurst(player.x, player.y, 0xf97316, 24, 160, 420);
        this.gsPlayers.forEach(o => {
          if (o.id !== player.id && Math.hypot(o.x - player.x, o.y - player.y) < 250) {
            const slowUntil = Date.now() + 3000;
            o.slowedUntil = slowUntil;
            store.updatePlayer(o.id, { slowedUntil: slowUntil });
            this.spawnSparkBurst(o.x, o.y, 0xf97316, 10, 80, 300);
          }
        });
        // Deactivation handled by updatePowerUps (dt-based).
        break;
      case 'teleport': {
        this.attachPowerAura(player.id, 0xa78bfa);
        const sprite = this.playerSprites[player.id];
        if (sprite) {
          this.tweens.add({
            targets: sprite,
            alpha: 0.25,
            scale: 0.94,
            duration: 220,
            yoyo: true,
            ease: 'Sine.InOut',
          });
        }
        const fromX = player.x;
        const fromY = player.y;

        // Teleport RIGHT NEXT TO the egg holder (or the loose egg) so it's an offensive
        // "close the gap" move — not a random escape. Land just outside tag range on the
        // side the teleporter is coming from, snapped clear of any obstacle.
        const holder = this.gsPlayers.find((p) => p.hasEgg && p.id !== player.id);
        const eggPos = useGameStore.getState().eggPosition;
        let target: { x: number; y: number };
        if (holder) {
          const ang = Math.atan2(fromY - holder.y, fromX - holder.x);
          const gap = 64; // ~1 step outside the ~55px tag range → "very near", not on top
          target = this.nearestFreePoint(holder.x + Math.cos(ang) * gap, holder.y + Math.sin(ang) * gap, this.gsObjects);
        } else if (eggPos) {
          target = this.nearestFreePoint(eggPos.x, eggPos.y, this.gsObjects);
        } else {
          target = findSafeSpawnPosition(this.mapWidth, this.mapHeight, this.gsObjects);
        }
        const rx = target.x;
        const ry = target.y;

        // The teleport jump runs on the scene clock; the active flag itself is
        // cleared by updatePowerUps (dt-based) shortly after, like every other type.
        this.time.delayedCall(500, () => {
          this.spawnPulse(fromX, fromY, 0xa78bfa, 20, 86, 0.5, 240);
          this.spawnSparkBurst(fromX, fromY, 0xa78bfa, 12, 90, 280);

          player.x = rx;
          player.y = ry;
          store.updatePlayer(player.id, { x: rx, y: ry });

          this.spawnPulse(player.x, player.y, 0xa78bfa, 18, 80, 0.5, 260);
          this.spawnSparkBurst(player.x, player.y, 0xa78bfa, 12, 92, 280);
        });
        break;
      }
      case 'shield':
        this.attachPowerAura(player.id, 0x22c55e);
        this.spawnPulse(player.x, player.y, 0x22c55e, 28, 118, 0.6, 400);
        player.isInvincible = true;
        store.updatePlayer(player.id, { isInvincible: true });
        
        const shieldGlow = this.add.circle(player.x, player.y, 30, 0x22c55e, 0.4);
        shieldGlow.setStrokeStyle(3, 0x4ade80, 0.8);
        this.tweens.add({
          targets: shieldGlow,
          scale: 1.2,
          alpha: 0.2,
          duration: 400,
          yoyo: true,
          repeat: -1
        });
        
        const updateShieldPos = this.time.addEvent({
          delay: 16,
          repeat: -1,
          callback: () => {
            if (!player.isInvincible) {
              shieldGlow.destroy();
              updateShieldPos.remove(false);
            } else {
              shieldGlow.x = player.x;
              shieldGlow.y = player.y;
            }
          }
        });
        // Deactivation (clears isInvincible → the glow above self-destroys) is handled
        // by updatePowerUps (dt-based).
        break;
    }
  }

  /**
   * Single idempotent power-up teardown — clears the active flag and any
   * type-specific effect state, then syncs the store. Called from updatePowerUps
   * when the dt-based active timer runs out, so a power-up can NEVER stay stuck
   * (the old per-type setTimeouts could be dropped/throttled in background tabs).
   */
  private deactivatePowerUp(player: Player) {
    if (!player.powerUpActive) return;
    player.powerUpActive = false;
    player.powerUpActiveMs = 0;
    player.speedBoostActive = false;
    // isInvincible is only ever set by the shield power-up, so it's safe to clear
    // here (the shield glow's own timer self-destroys once this flag is false).
    player.isInvincible = false;
    this.removePowerAura(player.id);
    useGameStore.getState().updatePlayer(player.id, {
      powerUpActive: false,
      speedBoostActive: false,
      isInvincible: false,
    });
  }

  /** Online: tell the room we (or a bot we steer) just used a power. */
  private broadcastPower(player: Player, type: string) {
    if (!this.isOnlineMp || !this.roomCode) return;
    const mine = player.id === 'player' || (player.isBot && this.agentAuthority);
    if (!mine) return;
    const socket = getGameSocket();
    const userId = player.id === 'player' ? this.localUserId : player.userId;
    if (!socket || !userId) return;
    socket.emit('power-used', { roomCode: this.roomCode, userId, type, x: Math.round(player.x), y: Math.round(player.y) });
  }

  /**
   * Another client's power. Effects on a player are applied by that player's own client
   * (it owns its movement), so an earthquake slows us here if we're in range, and the
   * bot-steering client slows its bots. Everyone sees the burst.
   */
  private applyRemotePower(payload: any) {
    if (!payload || typeof payload.userId !== 'string' || payload.userId === this.localUserId) return;
    const src = this.playerByUserId(payload.userId);
    const x = typeof payload.x === 'number' ? payload.x : src?.x;
    const y = typeof payload.y === 'number' ? payload.y : src?.y;
    if (x === undefined || y === undefined) return;
    const color = POWER_COLOR[payload.type] ?? 0xffffff;
    this.spawnPulse(x, y, color, 24, 76, 0.5, 260);
    this.spawnSparkBurst(x, y, color, 8, 72, 260);
    if (src) {
      this.spawnPowerLabel(src, src.character.powerUp.name.toUpperCase(), '#dbeafe');
      if (payload.type === 'speed-boost' || payload.type === 'shield' || payload.type === 'teleport') {
        this.attachPowerAura(src.id, color);
        const ms = payload.type === 'teleport' ? 650 : src.character.powerUp.duration;
        this.time.delayedCall(ms, () => this.removePowerAura(src.id));
      }
    }
    if (payload.type !== 'earthquake') return;
    this.spawnPulse(x, y, 0xf97316, 40, 180, 0.5, 500);
    const until = Date.now() + 3000;
    const store = useGameStore.getState();
    const hit = (p: Player) => {
      if (p.userId === payload.userId || Math.hypot(p.x - x, p.y - y) >= 250) return;
      p.slowedUntil = until;
      store.updatePlayer(p.id, { slowedUntil: until });
      this.spawnSparkBurst(p.x, p.y, 0xf97316, 10, 80, 300);
    };
    const me = this.gsPlayers.find((p) => p.id === 'player');
    if (me) {
      const wasSlowed = (me.slowedUntil ?? 0) > Date.now();
      hit(me);
      if (!wasSlowed && (me.slowedUntil ?? 0) > Date.now()) this.cameras.main.shake(400, 0.005);
    }
    if (this.agentAuthority) for (const b of this.gsPlayers) if (b.isBot) hit(b);
  }

  private endGame(result?: { winnerUserId: string | null; stats?: Array<{ userId: string; grabs: number; heldMs: number }> }) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.matchEnded = true;
    const store = useGameStore.getState();
    audioManager.stopTheme();
    audioManager.stopRunning();
    this.clearSnapshot(); // match over — don't resume it on a later refresh

    let winner: Player | null;
    if (result) {
      // Online: the server's tally and verdict, so every screen agrees.
      for (const st of result.stats ?? []) {
        const p = this.playerByUserId(st.userId);
        if (p) { p.eggHoldCount = st.grabs; p.eggHeldMs = st.heldMs; }
      }
      winner = result.winnerUserId ? this.playerByUserId(result.winnerUserId) ?? null : null;
    } else {
      // Last egg holder wins.
      const lastHolderId = store.lastEggHolderId;
      winner = this.gsPlayers.find((p) => p.hasEgg) ?? this.gsPlayers.find((p) => p.id === lastHolderId) ?? null;
    }

    store.setPlayers(this.gsPlayers.map((p) => ({ ...p })));
    if (!winner) {
      store.setGameResult(null, 'Nobody grabbed the egg!');
      return;
    }
    const grabs = winner.eggHoldCount ?? 0;
    const isLocalWinner = winner.id === 'player';
    const msg = isLocalWinner
      ? `🥚 You held the egg at the end! (${grabs} ${grabs === 1 ? 'grab' : 'grabs'})`
      : `🥚 ${winner.character.name} held the egg at the end! (${grabs} ${grabs === 1 ? 'grab' : 'grabs'})`;
    store.setGameResult(winner, msg);
  }

  private playerByUserId(userId: string): Player | undefined {
    if (userId === this.localUserId) return this.gsPlayers.find((p) => p.id === 'player');
    return this.gsPlayers.find((p) => p.userId === userId);
  }

}
