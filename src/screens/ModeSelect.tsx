import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HowToPlay } from '@/components/HowToPlay';
import { useGameStore } from '@/store/gameStore';
import { usePageTitle } from '@/hooks/usePageTitle';

interface ModeCardProps {
  title: string;
  tagline: string;
  taglineColor: string;
  bullets: string[];
  bulletColor: string;
  cta: string;
  icon: typeof User;
  iconColor: string;
  from: number;
  onClick: () => void;
  testId: string;
}

function ModeCard({ title, tagline, taglineColor, bullets, bulletColor, cta, icon: Icon, iconColor, from, onClick, testId }: ModeCardProps) {
  return (
    <motion.div
      initial={{ x: from, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative cursor-pointer"
      data-testid={testId}
    >
      <div className="relative pixel-panel p-4 md:p-8 short:p-3 overflow-hidden h-full flex flex-col">
        <Icon className={`w-10 md:w-20 h-10 md:h-20 short:w-8 short:h-8 mx-auto mb-2 md:mb-5 short:mb-1 ${iconColor}`} />
        <h2 className="pixel-font text-lg sm:text-2xl lg:text-3xl short:text-base text-white mb-2 md:mb-4 short:mb-1 tracking-wide">{title}</h2>
        <div className="bg-[#4d2813] pixel-border p-2 md:p-4 mb-3 md:mb-5 short:hidden">
          <p className="font-bold text-sm md:text-lg" style={{ color: taglineColor }}>{tagline}</p>
        </div>
        <ul className="text-left space-y-1.5 md:space-y-3 short:space-y-0.5 text-[#f4e7c3] mb-3 md:mb-6 short:mb-2 text-sm md:text-base flex-1">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5" style={{ color: bulletColor }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Button variant="game" size="lg" className="w-full">{cta}</Button>
      </div>
    </motion.div>
  );
}

export default function ModeSelect() {
  const navigate = useNavigate();
  const { setGameMode, initUserId } = useGameStore();
  usePageTitle('Choose your mode');

  useEffect(() => {
    initUserId();
  }, [initUserId]);

  const pick = (mode: 'single-player' | 'multiplayer') => {
    setGameMode(mode);
    navigate(mode === 'multiplayer' ? '/lobby' : '/solo');
  };

  return (
    <>
      <HowToPlay />
      <main
        className="h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg py-4 relative"
        style={{
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 1rem)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
        }}
      >
        <div className="w-full max-w-5xl mx-auto my-auto text-center space-y-4 md:space-y-8 short:space-y-2 p-2 md:p-4 short:p-0 relative z-10">
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="mx-auto inline-block pixel-panel px-5 py-3 short:py-1.5">
              <h1 className="pixel-font text-sm md:text-2xl title-pixel">Choose your mode</h1>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 md:gap-8">
            <ModeCard
              title="Solo"
              tagline="You against three bots."
              taglineColor="#ffc93c"
              bullets={['Easy, Normal or Hard bots', 'Works offline', 'Quick 60-second rounds']}
              bulletColor="#6ab04c"
              cta="Play solo"
              icon={User}
              iconColor="text-sky-400"
              from={-100}
              onClick={() => pick('single-player')}
              testId="mode-solo"
            />
            <ModeCard
              title="Multiplayer"
              tagline="Friends, strangers, and bots in the empty seats."
              taglineColor="#6ab04c"
              bullets={['Room codes for friends', 'Public rooms', 'Proximity voice chat']}
              bulletColor="#ffc93c"
              cta="Play online"
              icon={Users}
              iconColor="text-green-400"
              from={100}
              onClick={() => pick('multiplayer')}
              testId="mode-multiplayer"
            />
          </div>

          <Button onClick={() => navigate('/')} variant="outline" size="lg">
            <ArrowLeft className="mr-2 h-4 md:h-5 w-4 md:w-5" />
            Back
          </Button>
        </div>
      </main>
    </>
  );
}
