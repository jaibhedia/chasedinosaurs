/**
 * The controls for each way to play (keyboard and mouse, a controller, a phone), on the
 * Settings screen and in the in-game menu.
 *
 * It doubles as a check: a held key or pad button lights up its row, and the controller tab
 * names the pad and moves a dot with its stick. The pad goes through the game's own
 * readPad(), so what lights up here is what a match gets.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Gamepad2, Keyboard, Menu, Smartphone } from 'lucide-react';
import { useGameStore, type StickSide } from '@/store/gameStore';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';
import { useGamepadConnected } from '@/hooks/useGamepadConnected';
import { firstPad, readPad } from '@/lib/gamepadInput';

type Device = 'keyboard' | 'controller' | 'phone';
type Action = 'move' | 'power' | 'menu' | 'back';

interface Row {
  action: Action;
  label: string;
  /** Alternatives, shown as key caps with "or" between them. */
  keys: ReactNode[];
  note?: string;
}

const HOLD = "Hold it and the power fires the moment it's ready.";
const MENU_KEY = <Menu className="h-3.5 w-3.5" aria-label="the menu button" />;

// The bindings themselves live in gameScene (keys), gamepadInput (pad) and MobileControls
// (touch). Keep these rows in step with them.
const KEYBOARD: Row[] = [
  { action: 'move', label: 'Move', keys: ['W A S D', 'Arrow keys'] },
  { action: 'power', label: 'Power', keys: ['Space'], note: HOLD },
  { action: 'menu', label: 'Menu', keys: [MENU_KEY], note: 'Click it, top right.' },
];

const CONTROLLER: Row[] = [
  { action: 'move', label: 'Move', keys: ['Left stick', 'D-pad'] },
  { action: 'power', label: 'Power', keys: ['A', 'RB', 'RT'], note: HOLD },
  { action: 'menu', label: 'Menu', keys: ['Start'], note: 'Press it again to close.' },
  { action: 'back', label: 'Close menu', keys: ['B'] },
];

function phoneRows(stick: StickSide): Row[] {
  const power = stick === 'right' ? 'left' : 'right';
  return [
    { action: 'move', label: 'Move', keys: ['Stick'], note: `Drag it, bottom ${stick}.` },
    { action: 'power', label: 'Power', keys: ['Power button'], note: `Bottom ${power}. ${HOLD}` },
    { action: 'menu', label: 'Menu', keys: [MENU_KEY], note: 'Tap it, top right.' },
  ];
}

const TABS: Array<{ id: Device; label: string; icon: typeof Keyboard }> = [
  { id: 'keyboard', label: 'Keyboard & mouse', icon: Keyboard },
  { id: 'controller', label: 'Controller', icon: Gamepad2 },
  { id: 'phone', label: 'Phone', icon: Smartphone },
];

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
/** How far (px) the stick dot travels from the centre of its ring. */
const DOT_TRAVEL = 12;

/** Firefox prefixes the vendor and product ids, Chrome appends them in brackets. */
function padName(id: string): string {
  return id.replace(/\s*\(.*\)\s*$/, '').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '').trim() || 'Controller';
}

/** The actions whose keys are held, while `on`. */
function useHeldKeys(on: boolean): Action[] {
  const [held, setHeld] = useState<Action[]>([]);
  useEffect(() => {
    if (!on) return;
    const keys = new Set<string>();
    let last = '';
    const publish = () => {
      const next: Action[] = [];
      if ([...keys].some((k) => MOVE_KEYS.has(k))) next.push('move');
      if (keys.has(' ')) next.push('power');
      // Key repeat fires keydown many times a second; only re-render on a change.
      if (next.join() !== last) {
        last = next.join();
        setHeld(next);
      }
    };
    const down = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); publish(); };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); publish(); };
    const clear = () => { keys.clear(); publish(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      setHeld([]);
    };
  }, [on]);
  return held;
}

interface PadCheck {
  name: string | null;
  standard: boolean;
  active: Action[];
}

/**
 * Polls the first pad while `on`. The stick dot is moved by writing its transform, so the
 * panel only re-renders when the pad or the set of pressed actions changes.
 */
function usePadCheck(on: boolean, dot: RefObject<HTMLSpanElement>): PadCheck {
  const [check, setCheck] = useState<PadCheck>({ name: null, standard: true, active: [] });
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pad = firstPad();
      const s = pad ? readPad(pad) : null;
      if (dot.current) dot.current.style.transform = `translate(${(s?.x ?? 0) * DOT_TRAVEL}px, ${(s?.y ?? 0) * DOT_TRAVEL}px)`;
      const active: Action[] = [];
      if (s && (s.x || s.y)) active.push('move');
      if (s?.power) active.push('power');
      if (s?.menu) active.push('menu');
      if (s?.back) active.push('back');
      const key = `${pad?.id ?? ''}|${pad?.mapping ?? ''}|${active.join()}`;
      if (key !== last) {
        last = key;
        setCheck({ name: pad ? padName(pad.id) : null, standard: !pad || pad.mapping === 'standard', active });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, dot]);
  return check;
}

function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span className="px-heading inline-flex items-center border-2 border-[#f4e7c3]/30 bg-[#11111c] px-1.5 py-1 text-[8px] uppercase leading-none text-[#ffc93c] sm:text-[9px]">
      {children}
    </span>
  );
}

function Rows({ rows, active }: { rows: Row[]; active: Action[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const on = active.includes(r.action);
        return (
          <li
            key={r.action}
            className={`pixel-border flex flex-col gap-1 px-2 py-1.5 transition-colors ${on ? 'bg-[#2f5a1f]' : 'bg-[#4d2813]'}`}
            style={on ? { borderColor: '#6ab04c' } : undefined}
            data-testid={`controls-row-${r.action}`}
            data-active={on || undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-white sm:text-base">{r.label}</span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                {r.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-[#f4e7c3]/60">or</span>}
                    <KeyCap>{k}</KeyCap>
                  </span>
                ))}
              </span>
            </div>
            {r.note && <p className="text-xs leading-snug text-[#f4e7c3]/70">{r.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** A landscape phone with the stick and the power button where the match puts them. */
function PhonePreview({ stick }: { stick: StickSide }) {
  const power = stick === 'right' ? 'left' : 'right';
  return (
    <div className="relative h-16 w-28 shrink-0 border-2 border-[#f4e7c3]/50 bg-[#1a3a1a]" aria-hidden>
      <Menu className="absolute right-1.5 top-1 h-3 w-3 text-[#f4e7c3]/70" />
      <span className="absolute bottom-1.5 h-6 w-6 border-2 border-[#f4e7c3]/70 bg-black/30" style={{ [stick]: 6 }} />
      <span className="absolute bottom-2 h-4 w-4 bg-[#ffc93c]" style={{ [power]: 8 }} />
    </div>
  );
}

interface ControlsPanelProps {
  /** Opened from the menu of an online match, which keeps going behind it. */
  live?: boolean;
}

export default function ControlsPanel({ live = false }: ControlsPanelProps) {
  const isTouch = useIsTouchDevice();
  const padConnected = useGamepadConnected();
  const [tab, setTab] = useState<Device>(() => (padConnected ? 'controller' : isTouch ? 'phone' : 'keyboard'));
  const stickSide = useGameStore((s) => s.stickSide);
  const setStickSide = useGameStore((s) => s.setStickSide);
  const dot = useRef<HTMLSpanElement>(null);

  // Browsers reveal a pad on its first button press. Show the press where it can be checked.
  useEffect(() => { if (padConnected) setTab('controller'); }, [padConnected]);

  const heldKeys = useHeldKeys(tab === 'keyboard');
  const pad = usePadCheck(tab === 'controller', dot);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Controls">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`px-chip flex items-center justify-center gap-1.5 px-2 py-2 transition-all ${t.id === tab ? 'brightness-125' : 'opacity-60 hover:opacity-90'}`}
            data-testid={`controls-tab-${t.id}`}
          >
            <t.icon className="h-4 w-4 shrink-0 text-[#5fcde4]" />
            <span className="px-heading text-center text-[8px] uppercase leading-snug tracking-wider text-[#f4e7c3] sm:text-[9px]">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="px-panel flex flex-col gap-2 p-3" role="tabpanel">
        {tab === 'keyboard' && (
          <>
            <Rows rows={KEYBOARD} active={heldKeys} />
            <p className="text-xs text-[#f4e7c3]/70">Press a key to check it: its row lights up.</p>
          </>
        )}

        {tab === 'controller' && (
          <>
            <div className="flex items-center gap-3">
              {/* The left stick, live. */}
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#f4e7c3]/40 bg-black/30" aria-hidden>
                <span ref={dot} className="h-3 w-3 bg-[#ffc93c]" />
              </span>
              <p className="text-sm leading-snug text-[#f4e7c3]" data-testid="controls-pad-status">
                {pad.name
                  ? <><span className="font-black text-[#6ab04c]">{pad.name}</span> connected. Press a button to check it.</>
                  : 'No controller yet. Plug one in or pair it, then press any button: browsers only show a pad after its first press.'}
              </p>
            </div>
            {!pad.standard && (
              <p className="text-xs text-[#e8503a]">This pad doesn&apos;t report the standard layout, so its buttons may not match.</p>
            )}
            <Rows rows={CONTROLLER} active={pad.active} />
            <p className="text-xs text-[#f4e7c3]/70">Xbox, PlayStation and most USB or Bluetooth pads work in Chrome, Edge and Firefox.</p>
          </>
        )}

        {tab === 'phone' && (
          <>
            {/* The one setting goes first, so a landscape phone shows it without scrolling. */}
            <div className="flex items-center gap-3">
              <PhonePreview stick={stickSide} />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3]/80 sm:text-[9px]">Stick side</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['left', 'right'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={stickSide === side}
                      onClick={() => setStickSide(side)}
                      className={`px-chip px-2 py-2 transition-all ${stickSide === side ? 'brightness-125' : 'opacity-60 hover:opacity-90'}`}
                      data-testid={`controls-stick-${side}`}
                    >
                      <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3] sm:text-[9px]">{side}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Rows rows={phoneRows(stickSide)} active={[]} />
          </>
        )}

        {live && tab !== 'phone' && (
          <p className="text-xs text-[#ffc93c]">The match keeps going: anything you press here moves your dino or fires your power.</p>
        )}
      </div>
    </div>
  );
}
