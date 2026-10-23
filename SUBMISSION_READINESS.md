# Submission readiness

Code (done)
- [x] Escrow recovery: deadlines and `reclaim_expired`, with tests for stalled review, missing evidence and abandonment
- [x] Payout consensus: fixed payout bands and exact `payout_wei` agreement, with divergent-band tests
- [x] Commit-pinned GitHub evidence, truncation handling, on-chain review history

Evidence (you must produce these)
- [ ] `python -m pytest tests/direct -v` passes (attach output)
- [ ] Contract deployed on Studio Next (chain 61997) with args `2592000 1209600 1209600`; address and deployment tx in `DEPLOYMENT.json`
- [ ] Finalized transactions for funding, submission, consensus review, and payment or refund, listed in `docs/EVIDENCE.md`
- [ ] Every write showed a non-zero fee deposit in the receipt
- [ ] `npm run typecheck && npm run build` pass in `frontend/`; `npm run verify` output attached
- [ ] Vercel URL live, pointing at the deployed contract, wallet connect and disconnect verified
