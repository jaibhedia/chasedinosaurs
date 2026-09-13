# ETHOnline 2026 — final submission (copy-paste)

Verified live on 2026-09-13 before writing. Everything below is true as of that check.

| Field | Value |
|---|---|
| **Live app** | https://chasedinosaurs.fun |
| **GitHub** | https://github.com/jaibhedia/chasedinosaurs *(confirmed public)* |
| **Backend health** | https://chase-dinosaurs-4qb2.onrender.com/health |
| **Escrow (Arc testnet, 5042002)** | `0xD648def45026f437351D797dC3574fa97507BA83` |
| **Subgraph** | https://api.studio.thegraph.com/query/1760131/chase/0.98.1 |
| **Architecture diagram** | [`submission/ARCHITECTURE.md`](ARCHITECTURE.md) *(Arc requires this)* |

> The live domain is **https://chasedinosaurs.fun** — use it everywhere (form, video end
> card, posts).

---

## Short description (max 100 chars)

```
Multiplayer dino chase where ranked matches escrow USDC on Arc — winner takes the pot.
```
(86 chars)

---

## Description

> Paste the block below. Replace the state-channels placeholder currently in the form.

```
Chase Dinosaurs is a 60-second real-time multiplayer chase game where the AI opponents
read the blockchain to decide who to hunt.

The game: one golden egg drops into a 16-bit arena. Whoever holds it is the target and
everyone else hunts them; drop it, and the hunt turns on whoever picks it up. Be holding
the egg when the clock hits zero and you win. It runs in a browser, no install.

The stakes: ranked matches escrow real USDC on Arc, Circle's stablecoin-native L1. Both
players approve and stake into a per-match escrow contract, watch the pot climb in the
lobby, and the winner is paid out of that contract when the round resolves. The pot is
held by a contract, not by our database.

The part that isn't a leaderboard: every stake and settlement is indexed by a subgraph,
and the agent brains read that index before every decision. So the opponents don't only
see where you are on the map — they see that you're up 4 USDC across six matches, and
they treat you as the primary threat. They will leave a closer, unproven player alone to
mark the proven winner instead, guard their escape lane before they have even touched
the egg, and taunt them about their record by name. Take the subgraph away and the
opponents get measurably dumber. On-chain record changes who gets hunted; geometry still
decides the mechanics.

Getting in is one email address. Privy provisions an embedded wallet — no extension, no
seed phrase, nothing to install — because a browser game cannot ask a player to acquire a
funded wallet on a chain they have never heard of before they are allowed to play.

New players are handed 2 USDC automatically so they can afford a buy-in, which makes the
faucet worth attacking: sign-in is just an email, so ten inboxes would have been twenty
dollars. World ID Selfie Check closes that. One live human, one claim, keyed on a
nullifier — we never learn a name and never see a face.

The whole loop closes on itself: you stake, you play, the server settles on-chain, the
subgraph indexes that settlement, and the agents read the result in the next match. Your
record is the thing you carry between games, and it is the thing that makes you a target.
```

---

## How it's made

```
Four moving parts: a Next.js 16 / React 19 shell, a Phaser 3.90 game compiled by Vite and
bundled into the shell at build time, a Socket.IO match server on Render, and a Solidity
escrow on Arc. Contract work is Foundry; the browser talks chain through viem + wagmi with
Privy embedded wallets, the server through ethers v6.

ChaseStake.sol is deliberately four functions — create, join, settle, refund — because it
holds real money and every branch should be readable in one sitting. USDC is Arc's native
gas asset, but the contract never touches msg.value; it only uses the ERC-20 interface at
0x3600000000000000000000000000000000000000 (6 decimals), hardcoded rather than configurable.
The trust model is narrow on purpose: the server picks the winner but cannot pick the
amount, cannot pay a non-participant, and cannot pay itself unless it played. If it never
settles, a one-hour deadline lets every player reclaim their own stake, so funds can never
be stranded by a match that dies.

The AI is two-tier, and that split is what makes LLM opponents affordable. Every ~3.5s the
host sends a compact world snapshot; one inference call on 0G Compute returns a high-level
intent per agent — mode, target, persona, a one-line taunt — and the Phaser client executes
that intent every frame. The model never steers per-frame. Hard timeout, retry-once, and a
per-room last-good cache mean a blip degrades to the previous decision or to scripted
fallback instead of stalling the match.

The Graph is wired into that inference rather than bolted onto a UI. Before each call the
server joins every player's Privy user id to their wallet to their on-chain record from the
subgraph and puts it in the prompt. Critically it is a synchronous cache read that never
awaits inside the match loop — a slow or unreachable subgraph costs the inference budget
nothing and the agents just degrade to spatial-only reasoning.

Notable/hacky bits, all of which were real bugs first:

- The browser and the server must derive byte-identical match ids from a room code. One
  side is ethers.keccak256(ethers.toUtf8Bytes(code)), the other viem keccak256(toBytes(code)).
  A mismatch there would silently land stakes in an escrow the server never settles — money
  in a contract nobody would ever call settle() on. It's asserted across both stacks.
- Vite inlines env at build time, so NEXT_PUBLIC_SOCKET_URL got frozen into the game
  artifact — a deploy produced a perfect lobby whose Play button dialled localhost:3001 on
  the *player's* machine. Fixed by having the shell hand the socket URL to the game at
  launch, making one runtime value the source of truth for both bundles.
- qwen2.5-omni doesn't support JSON mode, so the intent parser pulls JSON out of free text.
- Payout is decided by backed-vs-unbacked, not human-vs-agent. House fill-agents have no
  principal behind them — no wallet, nobody accountable — so there is nobody to pay, and the
  pot goes to the best-scoring player who actually staked, ties broken deterministically. A
  player-owned agent is meant to be payable. That boundary is what makes agent-vs-agent
  betting a config change later rather than a rewrite.
- The faucet wallet is deliberately a different key from the settlement wallet. Sharing one
  would mean a drained faucet is also a match that cannot pay out.

Every integration degrades instead of crashing when its key is absent, and /health reports
which are actually armed — ai, arc, faucet, graph, world — so "is it really wired up" is a
URL, not a claim. All secrets are server-side only; nothing sensitive is ever NEXT_PUBLIC_.
```

---

## Prize tracks to select

| Track | Why it qualifies |
|---|---|
| **Arc / Circle** | Working frontend + backend, USDC escrow, multi-step settlement, architecture diagram included |
| **The Graph** | Subgraph feeds live data into agent reasoning — not raw display |
| **Privy** | Embedded wallets carry a real financial flow (stake → payout) |
| **World** | Selfie Check used as an abuse-prevention signal on a faucet holding real money |
| **0G** | ✅ Now safe to claim — the compute router is armed and `/health` reports `ai: true` |

## Remaining form fields
- **Live judging:** Yes — required for Top 10.
- **On track:** Yes.

## Both check-in blockers are now resolved
1. ~~Settlement not armed~~ → `/health` reports `arc.enabled: true`, ranked matches pay out.
2. ~~0G compute unconfigured~~ → `/health` reports `provider: "0G Compute", model: qwen2.5-omni`.

Live subgraph currently indexes real players at block 61855463, `hasIndexingErrors: false`.
