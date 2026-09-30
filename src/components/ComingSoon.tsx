import { Sparkles } from 'lucide-react';

/** A small teaser: more dinos and arenas are on the way. */
export function ComingSoon() {
  return (
    <p className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/40 pixel-border text-[#ffc93c] text-sm md:text-base short:text-xs">
      <Sparkles className="w-4 h-4 shrink-0" />
      More dinos and maps coming soon
    </p>
  );
}
