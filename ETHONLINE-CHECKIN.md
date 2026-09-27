# ETHOnline 2026 — Check-in 2 (copy-paste answers)

## Short description (max 100 chars)
> **REPLACE the current value.** It currently reads "Exchange onramp/offramp using state
> channels hub-and-spoke model" — that is not this project.

```
Multiplayer dino chase where ranked matches escrow USDC on Arc — winner takes the pot.
```
(86 chars)

## GitHub repository
> The form currently has the placeholder `https://github.com/hackathon/code`.

```
https://github.com/jaibhedia/chasedinosaurs
```
Must be **public** before submission — check this.

## What progress did you make since the last check-in?

```
Went from a single-player chase game to a real-money ranked mode on Arc.

Onchain: wrote and deployed ChaseStake.sol to Arc testnet (chain 5042002) — a
per-match USDC escrow keyed by keccak256(roomCode), with join/settle/refund and a
deadline so funds can never be stranded if a match never resolves.

Client: added Privy embedded wallets over wagmi + viem, so players sign in with an
email and get a funded wallet without ever seeing a seed phrase. Built the ranked
stake panel into the multiplayer lobby: approve → stake & enter → live pot that both
players watch climb as opponents join.

Server: the Socket.IO match server now owns settlement authority and posts the payout
when a match resolves. Verified that the server (ethers) and browser (viem) derive
byte-identical match IDs — a mismatch there would have let stakes land in an escrow
the server never settles.

19 commits since Sept 1. Production build is green.
```

## Any blockers? Need help?

```
Three, in order of how much they'd hurt:

1. Settlement is wired but not armed. The escrow's authority address is
   0x5b43790ba1CFd1dF57Cb280B3AE514E35BcaaB09 and it's funded, but we haven't pasted
   its key into the server env yet — so ranked matches currently play out and don't
   pay out. Staking and the live pot already work end to end.

2. AI opponents are on a scripted fallback because the 0G compute router isn't
   configured. Playable, but the "AI offline" path is what a judge would see today.

3. Local dev environment is disk-starved, which has been costing more iteration time
   than any actual code problem.

What would help: a sanity check on the escrow's refund path — specifically whether a
deadline-based refund is the right call for a hackathon demo versus something a judge
can trigger live.
```

## Is there anything else you think we should know?

```
The staking layer is real but deliberately small: one contract, one flow, no token.
We'd rather demo two players actually moving USDC than a broader surface that only
half works on stage.
```

## Remaining fields
- **Live judging:** Yes — you need it to qualify for Top 10.
- **On track:** Yes.
- **Prizes:** select the Circle / USDC-on-Arc track; add 0G only if the compute
  router is actually configured by submission (blocker #2 above).
