/**
 * "Verify with World ID" on the all-time leaderboard. Proving you're a unique human puts
 * you on the board, one row per person; playing never needs it. World's widget is loaded
 * only when tapped, so the game's own bundle doesn't grow.
 */
import { useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { IDKitRequestWidget, Preset } from '@worldcoin/idkit';
import { fetchRpContext, fetchWorldConfig, submitProof, type RpContext, type WorldConfig } from '@/lib/world';

interface Kit { Widget: typeof IDKitRequestWidget; preset: Preset; config: WorldConfig; rp: RpContext }

/** World App's error codes, in words a player can act on. */
const ERRORS: Record<string, string> = {
  user_rejected: 'Cancelled. You can keep playing and verify any time.',
  verification_rejected: 'Cancelled. You can keep playing and verify any time.',
  credential_unavailable: "Your World App doesn't have Selfie Check yet. Do it in World App, then try again.",
  world_id_4_not_available: 'Update World App, then try again.',
  connection_failed: "Couldn't reach World App. Try again.",
};

export function WorldVerify({ userId, onVerified }: { userId: string; onVerified: () => void }) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // Set by our own check in handleVerify, so the widget's generic error doesn't replace it.
  const reason = useRef('');

  const start = async () => {
    setBusy(true);
    setNote('');
    reason.current = '';
    try {
      const [mod, config, rp] = await Promise.all([import('@worldcoin/idkit'), fetchWorldConfig(), fetchRpContext()]);
      if (!config) throw new Error('World ID is off');
      // Staging only verifies through World's simulator, which can't issue Selfie Check (still
      // in preview), so there we ask for Proof of Human, which the server also accepts.
      const preset = config.environment === 'staging' ? mod.proofOfHuman() : mod.selfieCheck();
      setKit({ Widget: mod.IDKitRequestWidget, preset, config, rp });
      setOpen(true);
    } catch {
      setNote("Couldn't start World ID. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-panel flex flex-col items-center gap-2 p-3 text-center" data-testid="world-verify">
      <p className="text-sm text-[#f4e7c3] sm:text-base">
        Only verified humans rank here, one row per person. Playing never needs it.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="pixel-button flex items-center gap-2 !px-4 !py-2 text-xs sm:text-sm"
        data-testid="world-verify-start"
      >
        <ShieldCheck className="h-4 w-4 text-[#6ab04c]" />
        {busy ? 'Opening…' : 'Verify with World ID'}
      </button>
      {note && <p className="text-sm text-[#ffc93c]" role="status">{note}</p>}
      {kit && (
        <kit.Widget
          open={open}
          onOpenChange={setOpen}
          app_id={kit.config.app_id}
          action={kit.config.action}
          environment={kit.config.environment}
          rp_context={kit.rp}
          allow_legacy_proofs={false}
          preset={kit.preset}
          handleVerify={async (result) => {
            const outcome = await submitProof(userId, result);
            if (outcome === 'ok') return;
            reason.current = outcome === 'already-linked'
              ? 'This World ID already backs another player profile. One person, one row.'
              : "World ID checked out, but our server couldn't confirm it. Try again.";
            throw new Error(outcome);
          }}
          onSuccess={() => {
            setOpen(false);
            onVerified();
          }}
          onError={(code) => setNote(reason.current || ERRORS[code] || "Verification didn't finish. Try again.")}
        />
      )}
    </div>
  );
}
