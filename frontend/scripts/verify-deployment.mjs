// Reads the deployed GrantGate contract on Studio Next and prints an evidence table.
// Usage: npm run verify            (reads VITE_GRANTGATE_CONTRACT from frontend/.env)
//        node scripts/verify-deployment.mjs 0xYourContract
import { createClient, createAccount } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = process.env.VITE_GENLAYER_RPC || "https://studio-next.genlayer.com/api";
const address = process.argv[2] || process.env.VITE_GRANTGATE_CONTRACT;
if (!address) { console.error("Set VITE_GRANTGATE_CONTRACT in frontend/.env or pass the address as an argument."); process.exit(1); }

const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: [RPC] } } };
const client = createClient({ chain, endpoint: RPC, account: createAccount() });
const gen = (wei) => (Number(BigInt(wei) / 10n ** 12n) / 1e6).toString();

const snap = JSON.parse(String(await client.readContract({ address, functionName: "snapshot", args: [] })));
console.log(`GrantGate ${address} on ${RPC} (chain 61997)`);
console.log(`Windows (s): delivery ${snap.windows?.delivery}, evidence ${snap.windows?.evidence}, review ${snap.windows?.review}`);
console.log(`Grants: ${snap.grants.length}   Milestones: ${snap.milestones.length}\n`);
for (const g of snap.grants) {
  console.log(`Grant #${g.id} "${g.title}" ${g.status}  escrowed ${gen(g.total)} GEN, released ${gen(g.released)}, refunded ${gen(g.refunded)}`);
  console.log(`  funder ${g.funder}\n  grantee ${g.grantee}`);
  for (const m of snap.milestones.filter((x) => x.grant_id === g.id)) {
    console.log(`  - M${m.position} ${m.title}: ${m.status}  ${m.amount && gen(m.amount)} GEN  payout ${m.payout_pct}%  paid ${gen(m.paid)}  refunded ${gen(m.refunded)}  digest ${m.evidence_digest.slice(0, 12)}`);
    for (const h of m.history) console.log(`      history: ${h.event ?? h.outcome} ${h.payout_pct ?? ""} ${h.ref ?? ""}`);
  }
}
