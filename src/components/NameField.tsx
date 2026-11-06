import { useEffect, useId, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { cleanName, NAME_MAX } from '@/lib/playerName';

interface NameFieldProps {
  /** Called on leaving the field (or Enter) when the name changed, e.g. to rename in a room. */
  onCommit?: (name: string) => void;
  className?: string;
}

/**
 * "Your name", saved on this device as you type whenever it's a valid name, so whatever
 * you press next already uses it. The mode screen, Settings and a room's lobby all show it.
 */
export default function NameField({ onCommit, className = '' }: NameFieldProps) {
  const playerName = useGameStore((s) => s.playerName);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const [draft, setDraft] = useState(playerName);
  const editing = useRef(false);
  const before = useRef(playerName);
  const hintId = useId();
  // Follow a rename made elsewhere, unless the player is typing here.
  useEffect(() => { if (!editing.current) setDraft(playerName); }, [playerName]);
  const valid = cleanName(draft) !== '';

  const commit = () => {
    editing.current = false;
    const saved = useGameStore.getState().playerName;
    setDraft(saved);
    if (saved !== before.current) onCommit?.(saved);
  };

  return (
    <div className={`flex flex-col gap-1 text-left ${className}`}>
      <label className="flex items-center gap-2">
        <span className="px-heading shrink-0 text-[10px] uppercase tracking-wider text-[#f4e7c3]/80 sm:text-xs">Your name</span>
        <input
          type="text"
          value={draft}
          maxLength={NAME_MAX}
          onFocus={() => { editing.current = true; before.current = useGameStore.getState().playerName; }}
          onChange={(e) => { setDraft(e.target.value); setPlayerName(e.target.value); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          autoComplete="nickname"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hintId}
          data-testid="name-input"
          className="min-w-0 flex-1 border-4 border-[#261309] bg-[#4d2813] px-2 py-1 text-lg font-bold text-[#f4e7c3] select-text focus:border-[#ffc93c] focus:outline-none short:py-0.5 short:text-base"
        />
      </label>
      <p
        id={hintId}
        className={`text-sm leading-tight ${valid ? 'text-[#f4e7c3]/60 short:hidden' : 'text-[#ff8a75]'}`}
        data-testid="name-hint"
      >
        {valid ? 'Shown to other players and on the leaderboard.' : 'Use 2 to 16 letters or numbers.'}
      </p>
    </div>
  );
}
