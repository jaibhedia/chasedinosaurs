import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '@/config';
import { usePageTitle } from '@/hooks/usePageTitle';

const UPDATED = 'September 24, 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title);
  return (
    <main className="adventure-bg pixel-grid h-[100dvh] overflow-y-auto px-4 py-8 select-text">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/" className="font-heading text-[10px] text-[#5FCDE4] transition-colors hover:text-[#FFC93C]">
          {'<'} Back to game
        </Link>
        <article className="pixel-panel mt-4 p-6 text-[#f4e7c3] md:p-10">
          <h1 className="title-pixel font-heading text-lg leading-relaxed md:text-2xl">{title}</h1>
          <p className="font-body mt-3 text-sm opacity-60">Last updated: {UPDATED}</p>
          <div className="font-body mt-6 space-y-5 text-base leading-relaxed">{children}</div>
        </article>
        <p className="font-body mt-6 text-center text-xs text-[#f4e7c3]/40">© 2026 {SITE.studio}. All rights reserved.</p>
      </div>
    </main>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="font-heading mt-8 text-sm leading-relaxed text-[#FFC93C] first:mt-0">{children}</h2>;
}

function Contact() {
  return (
    <p>
      Reach us on{' '}
      <a href={SITE.socials.x} target="_blank" rel="noopener noreferrer" className="text-[#5FCDE4] underline hover:text-[#FFC93C]">X</a>{' '}
      or{' '}
      <a href={SITE.socials.telegram} target="_blank" rel="noopener noreferrer" className="text-[#5FCDE4] underline hover:text-[#FFC93C]">Telegram</a>.
    </p>
  );
}

export function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        {SITE.name} is a free game made by {SITE.studio} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You do not need an
        account to play, and we collect only what it takes to run a multiplayer match.
      </p>

      <H>What we process</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-[#FFC93C]">Your dino and room.</strong> The character you pick is shown to other
          players in your room and relayed through our multiplayer server. It is held in server memory and cleared
          when the room closes.
        </li>
        <li>
          <strong className="text-[#FFC93C]">In-match data.</strong> Your position, movement and power-up use are
          relayed live to the other players in your room so the game stays in sync. None of it is stored after the match.
        </li>
        <li>
          <strong className="text-[#FFC93C]">On-device storage.</strong> We keep a randomly generated player ID and
          your settings (sound, difficulty, whether you have seen the tutorial) on your device. It never leaves your
          device and is not a login.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Voice chat (optional).</strong> If you turn on voice, audio streams
          directly between players over WebRTC. We never record, store or listen to it; our server only helps players
          find each other to connect. You can mute any player at any time.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Bot banter.</strong> To make the bots talk, our server sends an
          anonymous snapshot of the match (positions and who holds the egg, no names or IDs) to an AI text provider.
          Nothing about you personally is included.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Analytics.</strong> On the website we use cookieless, aggregated
          analytics (page views, country). It does not build profiles or follow you across other sites.
        </li>
      </ul>

      <H>Cookies</H>
      <p>
        No advertising or cross-site tracking cookies. The only persistent data is the on-device storage described
        above, which you can clear from your browser or app settings at any time.
      </p>

      <H>Service providers</H>
      <p>
        We use a small number of providers to host and run the game: web hosting, a real-time multiplayer server,
        and an AI text provider for bot banter. They process data only to deliver the game.
      </p>

      <H>Children</H>
      <p>
        The game is for general audiences and is not directed at children under 13. Please don&rsquo;t share
        personal information over voice chat.
      </p>

      <H>Changes</H>
      <p>If this policy changes, the &ldquo;Last updated&rdquo; date above changes with it.</p>

      <H>Contact</H>
      <Contact />
    </LegalLayout>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Terms & Conditions">
      <p>
        {SITE.name} is made by {SITE.studio}. By playing, you agree to these Terms. If you don&rsquo;t agree,
        please don&rsquo;t use the game.
      </p>

      <H>License to play</H>
      <p>
        We grant you a free, personal, non-exclusive, non-transferable license to play the game for your own
        entertainment. We may change, suspend or discontinue any part of it at any time.
      </p>

      <H>Fair play</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>Don&rsquo;t cheat, exploit bugs, or use scripts or modified clients.</li>
        <li>Don&rsquo;t disrupt, overload, or try to gain unauthorized access to our servers.</li>
        <li>Don&rsquo;t harvest data from the game or other players.</li>
      </ul>

      <H>Voice chat and conduct</H>
      <p>
        You are responsible for what you say over voice chat. Don&rsquo;t be hateful, harassing, threatening or
        obscene, and don&rsquo;t impersonate others. Mute anyone you don&rsquo;t want to hear. We may remove or
        block players who break these rules.
      </p>

      <H>Intellectual property</H>
      <p>
        The game, including its code, artwork, characters, audio and design, is owned by {SITE.studio} or its
        licensors and is protected by intellectual-property laws. You may not copy, redistribute, sell, or create
        derivative works from it without our written permission. Third-party art is used under its authors&rsquo;
        licenses.
      </p>

      <H>No warranty</H>
      <p>
        The game is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind. It
        runs on hosted servers and may be unavailable, interrupted or laggy at times.
      </p>

      <H>Limitation of liability</H>
      <p>
        To the fullest extent permitted by law, we are not liable for any indirect, incidental or consequential
        damages arising from your use of, or inability to use, the game.
      </p>

      <H>Changes to these Terms</H>
      <p>
        We may update these Terms. Continuing to play after a change means you accept the updated Terms.
      </p>

      <H>Contact</H>
      <Contact />
    </LegalLayout>
  );
}
