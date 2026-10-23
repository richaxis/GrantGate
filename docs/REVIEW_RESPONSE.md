# Response to steward review

## 1. Funds could be locked in SUBMITTED / NEEDS_EVIDENCE

Every open milestone now carries a `deadline`, set from three constructor windows:

| State | Deadline | Who acts before it | After it |
|---|---|---|---|
| `PENDING` | creation + `delivery_window` (30d) | grantee submits proof | funder may `reclaim_expired` |
| `IN_REVIEW` | submission + `review_window` (14d) | anyone runs `review_milestone` (retry on fetch failure) | funder may `reclaim_expired` |
| `NEEDS_EVIDENCE` | verdict + `evidence_window` (14d) | grantee resubmits evidence | funder may `reclaim_expired` |

`reclaim_expired` refunds the full milestone amount, sets the terminal status `EXPIRED`, logs the event, and completes the grant when nothing is open. The grantee cannot submit after the deadline, and `cancel_milestone` was removed so the funder cannot pull funds from a grantee who is inside a window. Resubmission is bounded (one first submission plus two evidence rounds), so neither side can stall indefinitely.

Tests: `test_abandoned_unstarted_milestone_is_refunded_after_delivery_window`, `test_missing_evidence_then_abandonment_is_refunded`, `test_stalled_review_cannot_lock_funds`, `test_reclaim_before_deadline_reverts`, `test_only_funder_can_reclaim`, `test_grantee_cannot_submit_after_deadline`, `test_constructor_rejects_tiny_windows`.

## 2. Partial payouts depended on a score validators could disagree on by 15 points

Validators now return a payout band from a fixed set (0, 25, 50, 75, 100) and the exact `payout_wei` computed in code. The equivalence principle requires `outcome`, `payout_pct`, `payout_wei` and the evidence `digest` to be identical. The contract rejects off-band or inconsistent output (`MET` must be 100, `PARTIALLY_MET` 25/50/75, others 0) and re-derives the payout itself, reverting on any mismatch.

Tests: `test_validator_rejects_a_different_payout_band_with_the_same_outcome` (50% vs 75%, both PARTIALLY_MET), `test_validator_agrees_on_identical_band`, `test_validator_rejects_divergent_evidence_bytes`, `test_off_band_or_inconsistent_output_reverts_and_moves_nothing`, `test_partial_band_splits_exactly`.

## 3. Live deployment evidence

Deploy with `2592000 1209600 1209600`, run the flow in `docs/EVIDENCE.md`, then fill in `DEPLOYMENT.json`. `npm run verify` (in `frontend/`) prints the on-chain state for the evidence table.

## Recommended improvements, done

- Commit-pinned GitHub evidence: `commit`, `tree` and `blob` URLs are fetched at that commit; plain repo URLs use `HEAD` and the ref is logged. Test: `test_commit_pinned_github_evidence_is_fetched_at_the_commit`.
- Truncated evidence: the validator prompt is told when the excerpt is truncated and must answer `NEEDS_EVIDENCE` if the criteria cannot be verified from it; the flag is logged.
- Review transparency: every review and expiry is appended to an on-chain `review_log` (round, outcome, payout band, digest, ref, truncated, reasoning, time) and shown in the app under "Review history".
