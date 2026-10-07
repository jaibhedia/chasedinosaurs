# Making money: shop, skins and upgrades (plan, not built)

The Home screen shows a **Shop · Soon** button and the menus say "Shop, skins, more dinos
and maps coming soon". Nothing below is implemented yet. This is the order to build it in
and the decisions to make first.

## 1. Rules that keep the game fair

- **Sell looks, not power.** This is a 4-player fight over one egg. If money buys speed,
  a longer shield or a bigger blast, paying players win and everyone else stops playing.
  Online, every paid item is cosmetic.
- **"Upgrades" are cosmetic tiers.** A skin can level up (more colours, a trail, a
  victory pose) as you play. Stat upgrades, if you ever want them, live in solo only.
- **Everything paid can also be earned slowly**, except a few premium items. Free
  players are the people the paying players play against.

## 2. What to sell

| Item | What it is | Cost to make |
|---|---|---|
| Dino skins | Recolours of the 4 dinos (gold, ice, lava, neon, pixel-ghost...) | Low: palette swaps of the existing 24px sprites |
| Hats and accessories | Small overlay sprites on top of any dino | Low |
| Power effects | Colour and style of the Quick Blast ring, shield bubble, speed trail, teleport flash | Low: tint and particle changes |
| Egg skins | Golden egg variants (dragon egg, disco egg) | Low |
| Victory poses and share-card frames | Shown on Results and the share card | Low |
| New dinos | New characters with new powers | High. Make them **earnable**, with a paid "unlock now" |
| Season pass | ~6 weeks of rewards for playing; free track plus paid track | Medium, ongoing |
| Supporter pack | One-time bundle: exclusive skin plus a badge by your name | Low |

Starting prices (test them): single skin ₹49–₹149 / $0.99–$2.99, bundle ₹199–₹299 /
$3.99–$4.99, season pass ₹199 / $3.99.

**Before selling any skin**, check the license of the dino art (see `CREDITS.md`). Selling
recoloured versions of third-party sprites must be allowed by their license, or the paid
skins need original art.

## 3. Currency

Keep it simple:

- **Coins**: earned by playing (per match, a daily first win, holding the egg). They
  buy the basic skins.
- **Real money**: buys premium items, bundles and the season pass **directly**, with no
  second "gems" currency at first. Fewer screens to build, clearer for players and store
  reviewers. A premium currency can come later if the shop gets big.

## 4. Things that must exist first

1. **Accounts.** Right now a player is a random id saved in the browser, so clearing it
   or switching phones loses everything. Purchases need real accounts:
   - Google sign-in, plus Sign in with Apple (Apple requires it in the iOS app if you
     offer Google).
   - Guests keep playing as they do now and can attach an account later. Their coins come
     with them.
2. **A database.** Postgres (Neon or Supabase, free tier to start), next to the game server:
   - `users`;
   - `inventory` (who owns what);
   - `purchases` (a ledger of every payment: provider, receipt id, status);
   - `coins` (an append-only log, so balances can be audited).
3. **Equip and show.**
   - The player picks a skin and the lobby sends its id.
   - The server checks the player owns it (anything not owned shows the default look),
     then tells the room.
   - Everyone renders it.

## 5. Taking payments

Each platform has its own rules, and they decide this:

| Where | How | Cut |
|---|---|---|
| iPhone app | Apple In-App Purchase (required for digital items) | 15% (Small Business Program) |
| Android app | Google Play Billing (required for digital items) | 15% on the first $1M a year |
| Web / PWA | **Razorpay** for India (UPI, cards, wallets); **Stripe** or a merchant of record (Paddle, Lemon Squeezy) for other countries | ~2–5% |

- **RevenueCat** wraps both app stores behind one SDK (it has a Capacitor plugin). It
  sends one webhook to the server for buys, renewals and refunds. Free until about $2.5k a
  month in revenue.
- **Web and apps share one inventory through the account:** buy on the website, and the
  skin appears in the app too. Don't link from the iOS app to the web shop outside the
  places Apple allows it.
- **Webhooks grant items, the client never does.** Each payment webhook is checked
  (signature), recorded in `purchases` once (idempotent), then grants the items. A refund
  webhook takes them back.
- The crypto wallet on the Support page stays as donations only.

## 6. Legal and admin

- **India:**
  - GST registration once digital sales cross the threshold.
  - Razorpay needs a business (sole proprietor is fine) and a bank account.
  - Abstract Studio is the seller.
- **Privacy policy and terms:** add accounts, payments, the no-refund policy for digital
  items (the stores handle their own refunds), and what data the payment providers get.
- **Ages:** the game says it's not aimed at under-13s. Keep purchases behind an account and
  rely on the stores' parental controls in the apps.

## 7. Build order

| Phase | What | Rough time |
|---|---|---|
| 0 | Accounts (Google + Apple sign-in), Postgres, guest-to-account linking | ~1 week |
| 1 | Cosmetics system (own, equip, server check, render), 6–8 free skins, coins per match, Shop screen | 1–2 weeks |
| 2 | Web payments (Razorpay + Stripe or a merchant of record), webhooks, purchase ledger | ~1 week |
| 3 | In-app purchases through RevenueCat, store products, App Store and Play review | 1–2 weeks |
| 4 | Season pass, limited-time skins, events | ongoing |

Add analytics (PostHog, free tier) before phase 2, so you can see what sells:
- daily players;
- share of players who buy;
- revenue per daily player;
- day-1 and day-7 return rates.

## 8. Decisions needed before starting

1. Are the dino sprites licensed for selling recolours, or do paid skins need new art?
2. Prices in INR first, or USD?
3. Seller entity for Razorpay, Apple and Google: Abstract Studio as a registered business,
   or you as an individual for now?
4. First paid drop: a supporter pack, or a set of 4 skins (one per dino)?
