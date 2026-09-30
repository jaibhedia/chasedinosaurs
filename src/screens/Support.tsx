import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, CreditCard, Heart, Send, Twitter, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { isNativeApp } from '@/lib/platform';
import { SITE } from '@/config';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some in-app webviews: fall back to a hidden textarea.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function WalletCard() {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const address = SITE.donate.evm;

  const onCopy = async () => {
    setCopied((await copyText(address)) ? 'yes' : 'failed');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="pixel-panel p-4 md:p-6 short:p-3 flex flex-col text-left">
      <div className="flex items-center gap-2 mb-2 short:mb-1">
        <Wallet className="w-5 h-5 text-[#ffc93c] shrink-0" />
        <h2 className="pixel-font text-sm md:text-base short:text-xs text-white">Crypto</h2>
      </div>
      <p className="text-[#f4e7c3] text-sm md:text-base short:text-xs mb-3 short:mb-2">
        Send any amount to this wallet (EVM address). Check the address and network before you send.
      </p>
      <code
        className="block bg-[#4d2813] pixel-border px-3 py-2 short:py-1.5 text-[#ffc93c] text-xs md:text-sm break-all select-all font-mono"
        data-testid="support-address"
      >
        {address}
      </code>
      <Button variant="game" size="lg" className="w-full mt-3 short:mt-2" onClick={onCopy} data-testid="support-copy">
        {copied === 'yes' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied === 'yes' ? 'Copied!' : copied === 'failed' ? 'Press and hold to copy' : 'Copy address'}
      </Button>
    </div>
  );
}

function OtherWaysCard({ native }: { native: boolean }) {
  return (
    <div className="pixel-panel p-4 md:p-6 short:p-3 flex flex-col text-left">
      <div className="flex items-center gap-2 mb-2 short:mb-1">
        <CreditCard className="w-5 h-5 text-sky-400 shrink-0" />
        <h2 className="pixel-font text-sm md:text-base short:text-xs text-white">{native ? 'Get in touch' : 'Card and more'}</h2>
      </div>
      {!native && (
        <p className="text-[#f4e7c3] text-sm md:text-base short:text-xs mb-2">
          Card and other payment options are coming soon.
        </p>
      )}
      <p className="text-[#f4e7c3] text-sm md:text-base short:text-xs mb-3 short:mb-2 flex-1">
        Want to support the game another way? DM me on Telegram or X.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={SITE.socials.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-button flex items-center justify-center gap-2 py-2 text-sm"
        >
          <Send className="h-4 w-4" /> Telegram
        </a>
        <a
          href={SITE.socials.x}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-button flex items-center justify-center gap-2 py-2 text-sm"
        >
          <Twitter className="h-4 w-4" /> X
        </a>
      </div>
    </div>
  );
}

/**
 * Support the game. The crypto wallet shows on the web and the PWA only: the App Store
 * and Google Play don't allow taking donations outside their own payment systems (unless
 * you're a registered nonprofit), so the store apps just offer the DM links.
 */
export default function Support() {
  const navigate = useNavigate();
  const native = isNativeApp();
  usePageTitle('Support');

  return (
    <main
      className="h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg py-4 relative"
      style={{
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 1rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
      }}
    >
      <div className="w-full max-w-3xl mx-auto my-auto text-center space-y-4 md:space-y-6 short:space-y-2">
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="mx-auto inline-flex items-center gap-2 pixel-panel px-5 py-3 short:py-1.5">
            <Heart className="w-4 h-4 md:w-5 md:h-5 text-[#e8503a] fill-current" />
            <h1 className="pixel-font text-sm md:text-2xl title-pixel">Support the game</h1>
          </div>
          <p className="text-[#f4e7c3] text-sm md:text-base short:text-xs mt-3 short:mt-1.5 max-w-xl mx-auto">
            {SITE.name} is free, with no ads. If you enjoy it, your support keeps the servers running and new dinos coming.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className={`grid gap-3 md:gap-5 ${native ? 'max-w-md mx-auto' : 'grid-cols-1 sm:grid-cols-2 short:grid-cols-2'}`}
        >
          {!native && <WalletCard />}
          <OtherWaysCard native={native} />
        </motion.div>

        <Button onClick={() => navigate('/')} variant="outline" size="lg">
          <ArrowLeft className="mr-2 h-4 md:h-5 w-4 md:w-5" />
          Back
        </Button>
      </div>
    </main>
  );
}
