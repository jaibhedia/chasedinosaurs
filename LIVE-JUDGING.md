# Live judging — Chase Dinosaurs

**Today, Mon Sep 14 · 12:00 PM ET = 9:30 PM IST.** The Zoom button shows on the hacker
dashboard at 9:00 PM IST. Judges replay your submitted video, then about **3 minutes of Q&A**.
You won't present live. The Q&A is the whole game.

> ⚠️ Don't commit or push this file, and don't push anything else before judging. Section 4
> describes a live weakness, and the repo is public.

---

## 0 · Pre-flight (9:00 PM IST)

Checked 9:30 AM IST today: `/health` reports `fullyConfigured: true` (ai, arc, faucet, graph,
world), the site and game bundle return 200, the subgraph has no indexing errors, the repo is public.

- [ ] Open `https://chase-dinosaurs-4qb2.onrender.com/health`. **Render free plan sleeps**, so this
      wakes it up. Open it again at 9:25.
- [ ] **Dashboard → Project: note which 3 partner prizes you actually selected.** The form
      allows at most 3, but the README header names 4 (Arc, The Graph, Privy, World) and
      `submission/SUBMISSION-ANSWERS.md` lists 5 (adds 0G). If a judge asks "which partners?",
      name the real three.
- [ ] Rewatch your submitted video once. Write down every number and claim it makes
      (for example "up 4 USDC", "measurably dumber"). Those are what judges will quote back at you.
- [ ] Tabs ready, in this order:
  1. https://chasedinosaurs.fun
  2. `/health` (above)
  3. Escrow on arcscan: https://testnet.arcscan.app/address/0xD648def45026f437351D797dC3574fa97507BA83
  4. The four real transactions from one match: faucet → stake → join → settle (links in `JUDGING-RUNSHEET.md` §A2)
  5. GitHub → `server/src/agents/agentBrain.ts` scrolled to **line 123** (THREAT ASSESSMENT)
  6. GitHub → `submission/ARCHITECTURE.md` (the diagram renders there)
  7. Terminal with the subgraph query from the README, already run once
- [ ] **Backup video:** have your submitted video file saved locally. If they ask you to play it,
      screen-share with Zoom's **"Share sound"** box ticked. A past ETHGlobal finalist wrote that
      the green room spent ages teaching teams exactly this.
- [ ] Expect the green room to take a while (one past finalist waited ~90 min). Have water ready,
      stay nearby, and don't burn your energy while waiting.
- [ ] Close anything showing `server/.env`, keys, or wallet exports. Check Zoom's screen-share permission.
- [ ] Only run a live staked match if a judge asks. If they do: two browser profiles
      (normal + incognito), already signed in and funded.

---

## 1 · If they say "anything to add?" (15 seconds)

> "The one thing I'd underline: the loop closes. You stake, the server settles on Arc, The Graph
> indexes it, and the AI reads that record before the next match. Your wins make you the target.
> Everything in the video is live right now at chasedinosaurs.fun. Happy to open any piece of it."

---

## 2 · The three questions ETHGlobal says they always ask

**What inspired it?**
> "Chase started as a casual game with AI opponents for 0G's Zero Cup. When I added real stakes,
> the question became: what makes an AI opponent worth playing against when money's on the line?
> The answer was letting it know who's actually good. Your on-chain record is public, so the
> opponents read it. Winning makes you hunted."

*(If there's a real moment behind this, like a playtest or a friend who kept winning, say that first. A true story beats a pitch.)*

**What tools, and why?**
> "Arc, because USDC is the gas token. The player never needs a second token, so one faucet
> transfer funds the gas and the buy-in. Privy, because a browser game can't ask someone for a
> wallet extension on a chain they've never heard of, so it's email in and wallet out. The Graph,
> because match history lives in escrow events, not a database. There is no database, and anyone
> can rerun our query. World Selfie Check, because an email-gated faucet is ten inboxes for twenty
> dollars, and Selfie Check is the right amount of assurance for 2 USDC. And 0G Compute for the
> agent brains. Contracts are Foundry, with 26 tests."

**Hardest challenges?** Pick one or two:
- **Match IDs:** "The browser, using viem, and the server, using ethers, both hash the room code
  into a match ID. If they differ by one byte, stakes land in an escrow the server never settles.
  So we assert byte-identity across both stacks."
- **Agents winning ranked games:** "If a house bot held the egg at the buzzer, the payout resolved to
  nobody and both players' money sat locked for an hour. The fix was a rule: only a *backed* player
  can be paid. Unbacked house bots can't, so the pot goes to the best staked human."
- **A deploy that looked perfect:** "Vite froze the socket URL into the game bundle at build time.
  The live lobby worked, but Play dialled localhost on the player's own machine."
- **World ID:** "There are two apps called World ID. A staging QR scanned with the Play Store app
  fails silently. That cost hours, and it's written up in WORLD-FEEDBACK.md."

---

## 3 · Answers mapped to the five criteria

**Technicality: "How do LLM agents keep up with a real-time game?"**
> "Two tiers. Every few seconds the server makes one inference call per room, and it returns a
> high-level intent for each bot: hunt, flee, guard or intercept, plus a target and a taunt. Phaser
> executes that intent every frame. The model never steers per frame. A 6-second timeout, a
> last-good cache per room, and scripted fallback mean a slow model degrades play, it doesn't stall it.
> The subgraph read is a synchronous cache lookup that never waits inside the match loop."

**Originality: "Isn't this just a leaderboard?"**
> "The leaderboard is a side effect. The subgraph's main consumer is the AI prompt. On-chain
> reputation changes how opponents *behave* toward you. It changes who they prioritise, not the
> movement physics. The nearest bot still takes the direct chase."

**Practicality: "Could people use this today?"**
> "Yes, on testnet. It's live, and `/health` shows every integration switched on, so that's a URL,
> not a claim. Mainnet is a separate decision, because real-money PvP means dealing with gaming
> rules per jurisdiction. I didn't want to hand-wave that."

**Usability: "What does a new player actually do?"**
> "Enter an email and they have a wallet. The World ID prompt only appears if the faucet would
> actually pay them, so a player who already has funds never sees a selfie request. Free Play
> needs no wallet at all. Only Ranked touches the chain."

**WOW:** Point at the taunt. "The bot knows your record and says it to your face."

---

## 4 · Landmines: questions that hurt if you're not ready

Say these straight. Judges reward "here's the gap and the fix" far more than a dodge.

### 🔴 "Who decides the winner? Can a player cheat?"
**The truth:** the match simulation runs in the game client. At match end a client in the room
sends a `store-replay` event carrying the result, and the server settles on the winner in that
payload (`server/src/index.ts:860-912`). The contract bounds the damage: only players who staked
can be paid, the amount is fixed, and no outsider can be paid. But a modified client in a ranked
room could claim the win.
> "Honest answer: today the game client reports the result and the server settles it. The contract
> limits what that can do: it can only pay someone who staked in that match, and only the pot. But
> a tampered client could claim the win, and that's the first thing I'm fixing. Next step is for
> every staked client to sign the same result before the server settles, with anything disputed
> going to refund. Longer term, the match simulation runs on the server."

**Don't** demo a live staked match to a judge who is probing this.

### 🔴 "Your leaderboard shows everyone losing. Where's the player up 4 USDC?"
**The truth:** the escrow holds **12 USDC across 9 matches that never settled**, left over from
testing before the settlement key was switched on. Those stakes count against players' net until
refunded, which is why every row is ≤ 0. The "up 4 USDC across six matches" line is an
**illustration of the prompt rule**, not a live player.
> "The 4 USDC example shows the rule the agents follow. The live data is thinner: I have 9
> matches from before settlement was switched on, 12 USDC total, sitting in escrow. Anyone who
> staked in them can call refund(). That's the refund path working as designed, and it's why the
> nets read negative."

### 🔴 "You said the agents get *measurably* dumber without the subgraph. How did you measure it?"
**The truth:** it wasn't benchmarked. Don't defend the word "measurably".
> "Fair catch. 'Measurably' was too strong. I haven't run a benchmark. What I can show is the
> mechanism: the record goes into the prompt, and the prompt has explicit rules for proven winners
> (line 123 of agentBrain.ts). The test I'd run is how often bots target the top-earning player
> with the subgraph on versus off, holding distance equal."

### 🟠 "The server holds settlement authority. Isn't that centralised?"
> "Yes, deliberately narrow. The server can pick a winner, but it can't pick the amount, can't pay
> someone who didn't stake, and can't pay itself unless it played. If it disappears, every player
> can refund() their own stake after an hour, so funds can't get stranded. Removing that trust is
> the multi-signed result from the previous answer."

### 🟠 "Can someone front-run createMatch?"
**The truth:** the match ID is `keccak256(roomCode)`, and room codes are 6 characters shown in the
lobby. Someone who sees a code could create that match first with a different stake.
> "Yes, it's griefing, not theft. An attacker can take the match ID for a room code they've seen,
> but they can't win a room they aren't in, so they only lose their own stake. The fix is a
> server-salted match ID."

### 🟠 "What did you build during the hackathon versus before?"
> "Everything before is tagged `pre-ethonline2026`. Since then: 66 commits from Sep 8 to 13, 111
> files, about 24k lines. That covers the escrow contract and tests, Privy wallets, the faucet,
> World ID, the subgraph and agent targeting, and settlement. The game engine, maps, characters
> and the 0G brains came from before, and the README says so."

### 🔴 "How much of this is AI? What did *you* do?"
**Why this is red:** the rules say finalists can be ruled out if the project "relies entirely on
AI without meaningful contributions", and that AI use must be attributed **by file**. All 66
event commits carry a `Co-Authored-By: Claude` line, which anyone can see on GitHub. But
AI_USAGE.md's file table has only 8 rows, all covering the contract, licence and plan. The
Privy flow, faucet, World ID, subgraph, agent targeting and settlement have no rows.

Don't minimise it. Own the tool, then get specific about your judgement. **Use only the
examples below that are true for you:**
> "I used Claude Code as a pair programmer, and every commit says so. I didn't hide it. What I
> own is the decisions. Free Play stays walletless and only Ranked touches the chain. The escrow
> is four functions, and the server can pick a winner but not the amount. I cut 0G Storage and
> the 0G leaderboard mid-event because they were a second, weaker on-chain story. When bots
> won ranked matches, I made the call that unbacked bots can't be paid. I picked Selfie Check
> over Orb because the risk was 2 USDC. Plus the game design, art and audio. I read the contract
> line by line before it held money. One gap I'll admit: the AI_USAGE file table only covers the
> contract. The rest is attributed in the commits, and I'll add it to the table."

**If they ask "where are your prompts?"** "I didn't use a spec-driven tool. The directing
artifact is `plan.md`, revised in-repo throughout the event, so its git history shows how the
plan changed as mentor feedback and research came in."

### 🟠 "Is it open source?" *(Continuity rules require new work to be open)*
**The truth:** only `packages/` is MIT. `subgraph/`, `server/src/{arc,graph,world}` and the new UI
components sit outside it, and `packages/README.md` wrongly lists `subgraph/` as inside.
> "The contracts are MIT under packages/. The subgraph and server integration code were also
> built this week and belong under that licence too. That's a boundary mistake on my side, and
> I'll move them over."

### 🟡 Quick ones
- **"What if a bot wins a ranked match?"** Unbacked house bots can't be paid, so the pot goes to the
  staked human with the most egg holds, with ties broken deterministically. A lone staker playing
  bots just gets their own stake back: no house edge, no free money.
- **"Sybil after a server restart?"** The faucet ledger is a JSON file, and Render's free disk
  resets on redeploy. Backstop: any wallet already holding ≥ 1 USDC is refused. Production would
  use a proper key-value store.
- **"What's `replayRoot` in settle()?"** Left over from 0G Storage replays, which I removed during
  the event so there'd be one on-chain story. The contract was already deployed, so the server passes an empty string.
- **"World Selfie Check on a Continuity entry?"** Only if asked: "Selfie Check is what the product
  needed. I applied knowing eligibility is World's call."
- **"Why testnet?"** Arc mainnet plus real-money PvP is a compliance decision, not a weekend one.

---

## 5 · "What's next?" (keep to 20 seconds)
1. Results signed by every staked player, so no single party decides the winner.
2. Bring-your-own agent: players write their dinosaur's strategy, and World AgentKit keeps every agent tied to a human.
3. A mainnet decision after that.

> Say "the plan is" or "next". Never talk about roadmap items in present tense.
