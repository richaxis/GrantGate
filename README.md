# GrantGate

Fund a grant. Release it milestone by milestone. Let GenLayer validators judge the proof.

A funder escrows GEN against written milestones. The grantee submits a public proof URL (a repo, demo, dataset or report). GenLayer validators independently fetch it, judge it against the acceptance criteria, and reach consensus. Deterministic contract code then pays the grantee in full, pays pro-rata and refunds the rest, or refunds the funder. Remove GenLayer and an administrator would have to decide whether the proof is good enough.

## Why GenLayer is central

- `review_milestone` runs inside `gl.eq_principle.prompt_comparative`. Every validator fetches the proof itself, SHA-256 hashes the exact bytes, and must agree on outcome, score (within 15) and digest.
- Proof content is untrusted evidence. The prompt ignores instructions found inside it. Fetch errors and malformed model output revert as `TRANSIENT` and never move GEN.
- Validators must agree exactly on the payout band (0/25/50/75/100) and the payout in wei, not on a loose score.
- Funds can never be locked: every open milestone has a deadline, after which the funder can `reclaim_expired`. See `docs/REVIEW_RESPONSE.md`.
- Money rules are deterministic: exact funding, funder/grantee permissions, two evidence rounds, then refund.

## Layout

```
contracts/grantgate.py      Intelligent Contract (deadlines, banded payouts, review log)
tests/direct/               Direct-mode tests (gltest)
frontend/                   Vite + React app, YouTube-style UI + Studio dashboard
docs/ARCHITECTURE.md        Flow, fee handling, assumptions
docs/REVIEW_RESPONSE.md     How steward feedback was addressed
docs/EVIDENCE.md            Live-transaction evidence template
DEPLOYMENT.json             Fill in after deploying
SUBMISSION_READINESS.md     Checklist
```

## Network

Studio Next. RPC `https://studio-next.genlayer.com/api`, chain ID `61997`, explorer `https://explorer-studio-dev.genlayer.com/`. Stack: `genlayer-js@2.0.0-rc.1`, `@genlayer/transaction-kit@0.1.0-rc.2`.

## Fees

Every write goes through Transaction Kit: estimate, show an itemized receipt (fee deposit, value, wallet total), let the user pick a `low` / `standard` / `high` appeal posture, then sign and track. The app **refuses to submit any write whose quoted fee is zero**. Unused fee budget is refunded at finalization.

## 1. Deploy the contract to Studio Next

1. Open the Studio Next app for the network above and switch to it.
2. Create a new file, paste `contracts/grantgate.py`, and deploy it with constructor arguments `2592000 1209600 1209600` (delivery, evidence and review windows in seconds: 30, 14 and 14 days; each must be 1 hour to 365 days). Sign with a funded account.
3. Copy the contract address into `DEPLOYMENT.json` and keep it for step 3. Then follow `docs/EVIDENCE.md` to record the transactions.

## 2. Run locally

```bash
cd frontend
npm install
cp .env.example .env     # set VITE_GRANTGATE_CONTRACT=0x...
npm run dev              # http://localhost:5173
```

Install the wallet network once: connecting the wallet adds Studio Next (chain 61997) automatically.

## 3. Deploy the frontend to Vercel

1. Push this folder to GitHub (`git init && git add . && git commit -m "GrantGate" && git remote add origin <repo> && git push -u origin main`).
2. In Vercel choose **Add New → Project** and import the repository.
3. Set **Root Directory** to `frontend`. Framework preset: Vite (build `npm run build`, output `dist`; `vercel.json` already sets both and the SPA rewrite).
4. Under **Environment Variables** add:
   - `VITE_GRANTGATE_CONTRACT` = your deployed address
   - `VITE_GENLAYER_RPC` = `https://studio-next.genlayer.com/api`
   - `VITE_EXPLORER_URL` = `https://explorer-studio-dev.genlayer.com`
5. Click **Deploy**. Vite reads these at build time, so redeploy after changing any of them.

CLI alternative: `cd frontend && npx vercel --prod`.

## 4. Optional: measured fee profile

Run the tests with `gltest --fee-profile` against a fee-reporting Studio, then save the output as `frontend/src/fee-profile.json`. The app picks it up automatically; without it the kit uses network defaults.

## Tests

```bash
pip install genlayer-test
python -m pytest tests/direct -v
```
