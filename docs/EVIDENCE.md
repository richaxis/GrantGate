# Live evidence on Studio Next (chain 61997)

Network: Studio Next · RPC `https://studio-next.genlayer.com/api` · Chain ID `61997`
Explorer: https://explorer-studio-next.genlayer.com/

## Deployed contract

GrantGate (`contracts/grantgate.py`): [0x153095515dD048122876E6D4CA2dE6fd10F66298](https://explorer-studio-next.genlayer.com/address/0x153095515dD048122876E6D4CA2dE6fd10F66298)

## Transactions

Each transaction hash below opens its explorer page.

| # | Step | Transaction | What the explorer page shows |
|---|---|---|---|
| 1 | Contract deployment | [0x1fea3dbe…d50aa4](https://explorer-studio-next.genlayer.com/tx/0x1fea3dbe3257dcb0538dbc6e5fc6beae568c6ecd81124f68f96d6caecad50aa4) | Deployment of the GrantGate contract above |
| 2 | Fund grant (`create_grant`) | [0xb39ed931…504640](https://explorer-studio-next.genlayer.com/tx/0xb39ed931de077ed108875c74bf7e94b17311bc262591212498b76b9f67504640) | GEN escrowed in the contract, with the fee deposit |
| 3 | Submit proof (`submit_milestone`) | [0x5e13b55d…83271a](https://explorer-studio-next.genlayer.com/tx/0x5e13b55ddfba960f42c54a3385ba16184f1d4d1427c4808c3780c9733483271a) | Grantee submits the public proof URL; milestone moves to In review |
| 4 | Consensus review and payout (`review_milestone`) | [0x59617b37…123698](https://explorer-studio-next.genlayer.com/tx/0x59617b37a7378df146bc6f14ee5f2ad306689826e1f2886c4ed8c5b196123698) | Validators' Equivalence Principle output (outcome, payout band, payout in wei, evidence digest) and the transfer to the grantee |

## Full transaction hashes

1. `0x1fea3dbe3257dcb0538dbc6e5fc6beae568c6ecd81124f68f96d6caecad50aa4`
2. `0xb39ed931de077ed108875c74bf7e94b17311bc262591212498b76b9f67504640`
3. `0x5e13b55ddfba960f42c54a3385ba16184f1d4d1427c4808c3780c9733483271a`
4. `0x59617b37a7378df146bc6f14ee5f2ad306689826e1f2886c4ed8c5b196123698`

## How to verify

- **Funding:** open transaction 2. The value sent equals the sum of the milestone amounts, and the fee deposit is non-zero.
- **Submission:** open transaction 3. Only the grantee wallet can submit proof.
- **Consensus review:** open transaction 4 and check the Equivalence Principle Outputs panel. Validators must agree on the outcome, the payout band (0, 25, 50, 75 or 100), the exact payout in wei and the evidence digest.
- **Payment:** the payout to the grantee is sent by the contract inside transaction 4. Confirm it on the contract's [explorer page](https://explorer-studio-next.genlayer.com/address/0x153095515dD048122876E6D4CA2dE6fd10F66298) or on the grantee wallet's balance.
