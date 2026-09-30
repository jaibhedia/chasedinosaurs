import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Play, Send, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { InstallHint } from '@/components/InstallHint';
import { SITE } from '@/config';

export default function Home() {
  const navigate = useNavigate();
  const initUserId = useGameStore((s) => s.initUserId);
  usePageTitle();

  useEffect(() => {
    initUserId();
  }, [initUserId]);

  return (
    <main className="h-[100dvh] w-full flex flex-col relative overflow-y-auto">
      {/* 16:9 art with the logo and dinos. object-top keeps the logo in frame on tall
          screens; only the bottom grass is trimmed. */}
      <div className="absolute inset-0 z-0 bg-[#1a3a1a]">
        <img
          src={`${import.meta.env.BASE_URL}assets/main_bg.webp`}
          alt="Chase Dinosaurs"
          className="w-full h-full object-cover object-top"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="flex-1" />
      <div
        // Landscape phones (short:) get tighter spacing so the Play button, the iOS
        // install hint and this row all fit under the logo without covering it.
        className="relative z-10 flex flex-col items-center gap-2.5 sm:gap-4 short:gap-2 px-4 pb-5 short:pb-3"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
        >
          <Button
            variant="default"
            size="xl"
            onClick={() => navigate('/play')}
            className="px-10 sm:px-16 md:px-24 text-base sm:text-lg md:text-2xl py-3 sm:py-4 md:py-6 short:py-2.5 [&_svg]:size-4 sm:[&_svg]:size-5 md:[&_svg]:size-6"
            data-testid="home-play"
          >
            <Play className="fill-current" />
            Play
          </Button>
        </motion.div>

        <InstallHint />

        <div className="flex items-center gap-2.5 sm:gap-3">
          <a
            href={SITE.socials.telegram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="w-10 h-10 sm:w-14 sm:h-14 short:w-10 short:h-10 pixel-button flex items-center justify-center !p-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <Send className="w-4 h-4 sm:w-6 sm:h-6 short:w-4 short:h-4" />
          </a>
          <a
            href={SITE.socials.x}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
            className="w-10 h-10 sm:w-14 sm:h-14 short:w-10 short:h-10 pixel-button flex items-center justify-center !p-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <Twitter className="w-4 h-4 sm:w-6 sm:h-6 short:w-4 short:h-4" />
          </a>
          <Link
            to="/support"
            className="h-10 sm:h-14 short:h-10 pixel-button flex items-center gap-2 !px-3 sm:!px-4 !py-0 text-xs sm:text-sm short:text-xs opacity-90 hover:opacity-100 transition-opacity"
            data-testid="home-support"
          >
            <Heart className="w-4 h-4 sm:w-5 sm:h-5 short:w-4 short:h-4 text-[#e8503a] fill-current" />
            Support
          </Link>
        </div>

        <div className="flex items-center gap-3 text-[#f4e7c3]/80 text-[10px] sm:text-xs bg-black/40 px-2 py-0.5">
          <Link to="/privacy" className="hover:text-[#FFC93C] transition-colors">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="hover:text-[#FFC93C] transition-colors">Terms</Link>
          <span aria-hidden="true">·</span>
          <span>© 2026 {SITE.studio}</span>
        </div>
      </div>
    </main>
  );
}
