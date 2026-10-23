# Live evidence on Studio Next (chain 61997)

Fill this in after running the flow. Explorer: https://explorer-studio-dev.genlayer.com/

Contract address: `0x...`  Deployment tx: `0x...`  Constructor args: `2592000 1209600 1209600`

| Step | Who | Transaction | Result to confirm |
|---|---|---|---|
| Fund grant (`create_grant`) | funder wallet | `0x...` | Non-zero fee in the receipt, 1 GEN escrowed |
| Submit proof (`submit_milestone`) | grantee wallet | `0x...` | Milestone is In review |
| Consensus review (`review_milestone`) | any wallet | `0x...` | Verdict, payout band, digest recorded |
| Payment or refund | contract | `0x...` | Balance change on the grantee (or funder) wallet |
| Optional: `reclaim_expired` | funder wallet | `0x...` | Needs the review or delivery window to pass |

Also attach: output of `npm run verify`, a screenshot of the deployed Vercel app showing the grant, and the passing `python -m pytest tests/direct -v` output.
