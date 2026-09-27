# Judging run sheet: what to do in each scenario

Use this during the call. Full Q&A answers and the tough-question notes are in
[`LIVE-JUDGING.md`](LIVE-JUDGING.md). **Don't commit either file.**

**Mentor confirmed: they WILL play your video.** Your plan is 0 → A → A2. B is only a backup.

| What's happening | Go to |
|---|---|
| Waiting to be called (join the moment the button appears, 9:00 PM IST) | **0 · Read the room** |
| Video plays, then Q&A | **A** |
| "Show us a transaction" / "How would someone use this?" | **A2** |
| Video fails twice | **B** |

---

## 0 · Read the room: technical or business judges?

Get there early and listen. Every question asked before your turn tells you who's judging.

| Technical judges | Business judges |
|---|---|
| Introduce themselves as engineer, protocol, core dev, auditor, DevRel | Introduce themselves as founder, investor, partner, BD, product |
| Ask *how*: contracts, trust, architecture, latency, gas | Ask *who / why*: users, market, revenue, traction, competition |
| React to diagrams and code | React to user flow and outcomes |

**Mixed panel (most likely):** start each answer with one sentence about the player, then one technical
sentence. Their follow-up tells you which way to go deeper.

### Your 20-second framing, in two versions

**Technical:**
> "It's a closed loop across four systems. A USDC escrow on Arc that the server can settle but can't
> redirect. A subgraph indexing it. And an AI layer that reads that subgraph before every decision
> without ever blocking the 60-second match."

**Business:**
> "Putting real money on a quick game usually breaks in three places: getting a wallet, trusting who
> holds the pot, and waiting to get paid. Here it's one email to a funded wallet, the pot sits in a
> public contract instead of with us, and the winner's paid the moment the round ends. The AI
> opponents fill empty seats and play harder against people who keep winning."

### Business-judge cue cards (not covered in LIVE-JUDGING.md)

| If they ask… | Say… |
|---|---|
| Who's the user? | "People who already play quick browser games with friends and want something on the line. No install, no wallet setup." *(Swap in your real target player if you have one.)* |
| Why crypto at all? | "The pot sits in a public contract, not with the game company. The payout is instant in USDC, anywhere. Anyone can check the match history." |
| Business model? | "Today the winner takes 100%. There's no house cut while it's on testnet. The obvious model is a small cut of ranked pots. Later: player-built agents, and letting people back them." |
| Traction? | **Be straight:** "It's a hackathon build on testnet: 15 on-chain matches across 3 wallets so far, and it's playable free right now. Real players are the next milestone." |
| Competition? | "Real-money skill-game platforms exist, but they hold your money. Here a public contract does, and AI opponents mean a room with two people still plays full." |
| Regulation? | "Real-money PvP is regulated country by country. That's why it's testnet today. Mainnet needs legal review and geo-restrictions. World ID gives one person, one account. It isn't KYC." |
| Why come back? | "Your record follows you. Win more and the AI hunts you harder. That's the hook." |
| Empty rooms / cold start? | "AI agents fill empty seats, so two players get a full four-player match." |

---

## A · They play your video

**If asked to introduce yourself (≤10 seconds):**
> "Hi, I'm Shantanu, solo builder of Chase Dinosaurs. Everything in the video is live at chasedinosaurs.fun."

**While it plays:** mute your mic. Watch the judges' faces, not the video. Note any moment where
someone leans in, frowns, or writes something down. That's probably their first question.

**When it ends (15 seconds, only if there's a pause):**
> "The one thing I'd underline: the loop closes. You stake, the server settles on Arc, The Graph indexes
> it, and the AI reads that record next match. Your wins make you the target. Happy to open any piece of it."

### How to answer
- **Answer first, then the reason.** Keep it to 30 seconds and then stop talking. Silence is fine.
- Skip "great question". It costs 2 seconds and every judge hears it 50 times a day.
- If two judges ask at once: "I'll take the settlement one first, then the AI one."
- If you don't know: **"I don't know yet. Here's how I'd find out: …"**

### Cue cards (a quick glance, then speak)

| If they ask… | Start with… | Full answer |
|---|---|---|
| Inspiration? | "What makes an AI opponent worth playing when money's on the line? Knowing who's good." | LIVE-JUDGING §2 |
| Tools, why? | "Arc: USDC *is* gas. Privy: email in, wallet out. Graph: no database, anyone can rerun the query. World: right-sized for a 2-USDC faucet. 0G: the brains." | §2 |
| Hardest challenge? | "The browser and server had to hash a room code to the *same bytes*, or stakes land in an escrow nobody settles." | §2 |
| Real-time LLM agents? | "Two tiers. One inference call every few seconds sets intent, and the game executes it every frame." | §3 |
| Just a leaderboard? | "The leaderboard's a side effect. The main consumer is the AI prompt." | §3 |
| **Who picks the winner / can I cheat?** | "Honestly, today the game client reports the result. The contract limits it to staked players and the pot. The fix is that every staked player signs the result." | §4 🔴 |
| **Leaderboard all negative?** | "Nine matches from before settlement was switched on, 12 USDC, refundable. The 4-USDC example is the rule, not a live player." | §4 🔴 |
| **"Measurably dumber"?** | "Too strong. I haven't benchmarked it. Here's the mechanism, line 123, and the test I'd run." | §4 🔴 |
| **AI use / what did you do?** | "Every commit says Claude co-authored it, and I didn't hide that. What's mine is the decisions: …" | §4 🔴 |
| Server centralised? | "It can pick a winner, not the amount. If it vanishes, players refund after an hour." | §4 |
| Before vs during? | "Tagged `pre-ethonline2026`. Since then: 66 commits, 111 files." | §4 |
| Open source? | "The contracts are MIT. The subgraph and server integrations should be too, and I'll move them." | §4 |
| Mainnet? | "Real-money PvP is a compliance decision, not a weekend one." | §4 |
| What's next? | "Results signed by every player. Then bring-your-own agents. Then a mainnet decision." | §5 |

---

## A2 · Show the transactions + explain how it's used

### Transaction kit: one real match, checked on-chain today

Open these four tabs **before 9:00 PM IST**, in this order. All three escrow transactions carry the same
match ID, `0x00b1891b…`.

| # | What happened | Tx |
|---|---|---|
| 1 | **Faucet:** new player `0xe1d2…` received 2 USDC from the faucet wallet `0xe49a…9EfA` (Sep 10) | [0x3c0f53b6…](https://testnet.arcscan.app/tx/0x3c0f53b6368ad7f8c18f9777a23dbbff8166c1fd520819ff3849871f24935e76) |
| 2 | **Stake:** `0xe1d2…` created the match and put 1 USDC into escrow (Sep 13, 4:30 PM IST) | [0x4dc12ac3…](https://testnet.arcscan.app/tx/0x4dc12ac3441b3bea46149666d4e13eccdcea090f7469bead500ff5d574c3daa9) |
| 3 | **Join:** `0x87dd…` staked 1 USDC, **13 seconds later** | [0xb1d9f2e9…](https://testnet.arcscan.app/tx/0xb1d9f2e917af2228c1867c27154d457008f9156c9339506be6c9d00a9c8efccf) |
| 4 | **Payout:** the server called `settle`, and the escrow paid the **2 USDC pot** to the winner `0xe1d2…`, **70 seconds after the join** | [0x8ab44aea…](https://testnet.arcscan.app/tx/0x8ab44aea22e322887332ce988a317b6b2c84d726d4a2f585c05f6ff97b3549f0) |

Also keep open: [the escrow contract](https://testnet.arcscan.app/address/0xD648def45026f437351D797dC3574fa97507BA83) · `/health`.

**What to point at on arcscan:** the **Token transfers** row (1 USDC in on tx 2, 2 USDC out on tx 4)
and **From** on tx 4, the server address `0x5b43…`.

**Say while clicking through (~40 seconds):**
> "Here's one real match, start to finish. A new player got 2 USDC from the faucet. They opened a match
> and staked 1 USDC. It went into the escrow contract, not to me. A second player joined 13 seconds later.
> After the lobby and the 60-second round, the server called settle and the contract paid the 2-USDC pot
> to the winner. Same match ID on all three, so you can trace it. That payout event is what The Graph
> indexes, and what the AI reads about this player next match."

**Likely follow-ups:**
- *"Why is the Logs tab raw hex?"* → "I haven't verified the contract on the explorer yet. The source is in
  the repo under `packages/contracts-arc`. Topic one is the match ID, topic two is the winner."
- *"Your server address played matches too?"* → "Those were solo test matches while I was bringing up
  settlement. A lone staker just gets their own stake back, so it netted zero, and the leaderboard hides house wallets."
- *"What if the server never settles?"* → "After an hour, each player calls `refund()` and takes back their own stake."

### "How would someone use it?" (~45 seconds)

> "You open chasedinosaurs.fun. Nothing to install. You can play Free Play against the AI with no wallet
> at all. When you want stakes, you hit Play Multiplayer and sign in with your email, and a wallet appears
> in the top bar. If you're new, you verify with World ID once and 2 USDC lands. You create or join a room,
> approve 1 USDC, stake and enter, and the pot shows in the lobby. Then it's sixty seconds: grab the egg,
> survive the dinosaurs, be holding it at the buzzer. The results screen says the pot was paid out and
> links the transaction. Next match, the AI already knows your record."

**If they want to see it:** switch to your pre-signed-in Chrome profile and click **PLAY MULTIPLAYER** →
point at the wallet → **Create Room** → show the stake panel (**Approve 1 USDC** / **Stake & enter**).
**Don't start a match.** Go back to the transaction kit for the payout. It's faster, and it can't fail.

---

## B · Backup only (video fails twice): live intro + demo (4:00)

### Setup: do this at ~6–7 PM IST, and do a full timed rehearsal once

- [ ] **Two Chrome profiles**, not incognito. Incognito drops the login if the window closes, and two tabs
      share one Privy session.
  - Profile **A** (you, the host): signed in, sitting on the multiplayer lobby.
  - Profile **B** (second player): signed in, on the multiplayer lobby.
- [ ] Both wallets hold **≥ 1.5 USDC** (1 to stake plus gas). The faucet refuses wallets that already have 1 USDC, so top
      up from your own wallet if needed, **never from the settlement key**.
- [ ] **Warm-up ranked match at ~9:00 PM IST.** It wakes the Render backend and 0G, and gives you a fresh
      `MatchSettled` tx to fall back on. Keep that arcscan tab open.
- [ ] Other tabs: `/health` · arcscan escrow · terminal with the subgraph query · GitHub `agentBrain.ts#L123`
      · `submission/ARCHITECTURE.md`.
- [ ] Zoom: **share your entire screen**, not one window, so you can switch between A and B. Game volume low.
      Turn on macOS Do Not Disturb.

### The flow

| Time | Do | Say |
|---|---|---|
| **0:00–0:20** | Landing page | "Hi, I'm Shantanu. Chase Dinosaurs is a sixty-second multiplayer chase game. One golden egg, and whoever holds it is the target. Ranked matches escrow real USDC on Arc, winner takes the pot. And the AI opponents read your on-chain record through The Graph to decide who to hunt. Here's the whole loop, live." |
| **0:20–0:45** | Profile A → **PLAY MULTIPLAYER** → point at the wallet address in the top bar | "Getting in is one email. Privy creates an embedded wallet, so there's no extension and no seed phrase. I signed in beforehand to skip the email code." |
| **0:45–1:00** | Stay in lobby. Don't run Selfie Check live. | "New players get 2 USDC automatically. Sign-in is just an email, so that faucet is farmable. World ID Selfie Check gates it: one human, one claim, no name, no face. It only appears for players the faucet would actually pay." |
| **1:00–1:40** | A: **Create Room** → read the room code aloud → **Approve 1 USDC** → **Stake & enter** → switch to B: **Join with Code** → **Approve 1 USDC** → **Stake & enter** → POT shows 2 | *(while txs confirm)* "Both players stake into an escrow contract on Arc. The pot sits in the contract, not my database. USDC is Arc's gas token, so there's no second token to go buy. …There's the pot at two." |
| **1:40–1:45** | Both ready → A: **START GAME** | "Empty seats fill with AI agents." |
| **1:45–2:45** | Play the 60s round in A | "Every few seconds the server makes one inference call on 0G Compute. It returns what each dinosaur does and who it's after, and the game executes that every frame. That panel shows it live. Before each call, the server looks up every player's staking record from The Graph, so a proven winner gets marked first. The nearest bot still chases directly. The record changes *who* gets priority." *(If a taunt appears, read it out. Don't promise one.)* |
| **2:45–3:15** | Results → **Pot paid out** → **View the transaction** → arcscan `MatchSettled` | "The server settled on-chain, and the winner was paid from escrow. Here's the transaction. That settlement is what the subgraph indexes, and what the agents read next match. The loop closes." |
| **3:15–3:45** | Terminal: run the subgraph query → flip to `agentBrain.ts` line 123 | "That's public. Anyone can run this query. And this is where it goes: the threat rules in the prompt." |
| **3:45–4:00** | Back to the game | "Privy gets you in, World keeps the faucet honest, Arc holds the money, The Graph makes the opponents smart. Sixty seconds, one egg, real stakes." |

**If a judge interrupts mid-demo:** answer, then skip straight to the **Results** row. Settlement plus arcscan is the proof.

### When something breaks (say it calmly and move on)

| Problem | Say | Do |
|---|---|---|
| Lobby won't connect or loads slowly | "The backend's on a free tier and waking up." | Open `/health`. Meanwhile show the warm-up tx on arcscan and the subgraph query, then retry. |
| Approve/Stake stuck > 15s | "Testnet RPC is slow right now." | Show the warm-up match's `MatchSettled` on arcscan, then do the **single-player fallback** below. |
| 0G panel goes red / scripted | "0G is rate-limiting. The agents fall back to scripted steering instead of freezing the match, which is by design." | Keep playing. |
| No settlement link on results | "Settlement posts from the server. Here's the one from my warm-up." | Warm-up arcscan tab. |
| Zoom share dies | "One sec, resharing." | Reshare the entire screen. If it takes over 30s, talk through `ARCHITECTURE.md` instead. |
| Everything's down | "Let me walk you through how it works instead, and it's all live at chasedinosaurs.fun." | Architecture diagram → arcscan → subgraph query. Nothing here needs the backend. |

### Single-player fallback (~90 seconds, no wallet)
**SINGLE PLAYER** → pick a character → pick a map → play against the 0G agents.
> "This is Free Play. No wallet at all, same AI brains. Ranked adds the stake, and The Graph adds the record."
