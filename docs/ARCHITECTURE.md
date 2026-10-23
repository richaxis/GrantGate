# Architecture

```
create_grant (payable, value = sum of milestones)         deadline = now + delivery_window
  -> submit_milestone (grantee, https proof URL)           deadline = now + review_window
  -> review_milestone (anyone) -> consensus on payout band
       100 (MET)                -> RELEASED, grantee paid in full
       25 / 50 / 75 (PARTIAL)   -> PARTIAL, band share to grantee, remainder to funder
       0 (NOT_MET/NEEDS_EVIDENCE) -> NEEDS_EVIDENCE (max 2 rounds, deadline = now + evidence_window), then REJECTED and refund
  -> reclaim_expired (funder, only after the deadline) -> EXPIRED, full refund
grant becomes COMPLETED when every milestone is terminal
```

Views return JSON strings (`snapshot`, `get_milestone`) so the frontend needs one read per refresh.

## Frontend

Routes: `/` feed, `/grant/:id` watch page (milestones are the chapters), `/create`, `/studio` dashboard, `/reviews` queue.
`lib/wallet.tsx` connect/disconnect (disconnect revokes permissions where supported and sets a local flag so the page does not silently reconnect). `lib/tx.tsx` is the fee-review flow built on `kit.estimate`, `kit.submit`, `kit.track`.

## Assumptions to verify on the RC packages

- Chain object: `studioDevnet` from `genlayer-js/chains`, with the RPC pinned to Studio Next.
- Quote shape: the fee is read from `quote.feeValue` (falls back to the largest fee-like field). In dev the quote is logged with `console.debug`.
- The kit is used for the fee quote and receipt. The final signing step calls `client.writeContract({ value, fees })` from `genlayer-js`, because the kit did not carry `value` through (the contract saw 0 and reverted with `grant funding required`). `fees` is the quote's `{ distribution, feeValue }`, found by `findFees` in `lib/chain.ts`.
- Success requires `executionResultName` to be `FINISHED_WITH_RETURN`.
