import { createClient, createAccount } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createTransactionKit } from "@genlayer/transaction-kit";

export const RPC: string = import.meta.env.VITE_GENLAYER_RPC || "https://studio-next.genlayer.com/api";
export const EXPLORER: string = import.meta.env.VITE_EXPLORER_URL || "https://explorer-studio-dev.genlayer.com";
export const CONTRACT: string = import.meta.env.VITE_GRANTGATE_CONTRACT || "";
export const CHAIN_ID = 61997;
export const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);

// Studio Next is the RC stack (chain 61997). Reuse the RC chain definition and pin the Studio Next RPC.
export const chain: any = { ...(studioDevnet as any), id: CHAIN_ID, rpcUrls: { default: { http: [RPC] } } };

// Optional measured profile from `gltest --fee-profile`; the kit falls back to network defaults without it.
const profiles = import.meta.glob("../fee-profile.json", { eager: true, import: "default" }) as Record<string, unknown>;
const feeProfile = Object.values(profiles)[0];

export function readClient() {
  return createClient({ chain, endpoint: RPC, account: createAccount() } as any) as any;
}

export function makeKit(address: string) {
  return createTransactionKit({ chain, provider: window.ethereum, account: address, suggestions: feeProfile } as any) as any;
}

/** Provider-backed client used to sign writes. genlayer-js takes `value` and `fees` explicitly. */
export async function writeClient(address: string) {
  await ensureChain();
  return createClient({ chain, endpoint: RPC, account: address, provider: window.ethereum } as any) as any;
}

/** Finds `{ distribution, feeValue }` anywhere in a kit quote so the exact quoted preset is submitted unchanged. */
export function findFees(quote: any): { distribution: unknown; feeValue: bigint } | undefined {
  const seen = new Set<any>();
  const walk = (o: any, depth: number): any => {
    if (!o || typeof o !== "object" || depth > 4 || seen.has(o)) return undefined;
    seen.add(o);
    if ("distribution" in o && "feeValue" in o) return o;
    for (const k of Object.keys(o)) { const r = walk(o[k], depth + 1); if (r) return r; }
    return undefined;
  };
  const f = walk(quote, 0);
  if (!f) return undefined;
  try { return { distribution: f.distribution, feeValue: BigInt(f.feeValue) }; } catch { return undefined; }
}

export async function ensureChain(): Promise<void> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask or another EIP-1193 wallet.");
  const current = String(await eth.request({ method: "eth_chainId" }));
  if (current.toLowerCase() === CHAIN_HEX) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (e: any) {
    if (e?.code !== 4902 && e?.code !== -32603) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: CHAIN_HEX, chainName: "GenLayer Studio Next", rpcUrls: [RPC], nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 }, blockExplorerUrls: [EXPLORER] }],
    });
  }
}

// ---- helpers -------------------------------------------------------------
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export function formatGen(wei: bigint | string | number, digits = 4): string {
  const v = BigInt(wei);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
export function parseGen(text: string): bigint {
  const t = text.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) throw new Error(`"${text}" is not a valid GEN amount`);
  const [w, f = ""] = t.split(".");
  return BigInt(w) * 10n ** 18n + BigInt(f.padEnd(18, "0"));
}
export function errText(e: unknown, fallback = "Something went wrong"): string {
  const x = e as any;
  return (typeof e === "string" ? e : x?.shortMessage || x?.message || fallback).toString().slice(0, 280);
}

/** Reads the fee deposit out of a kit quote. Prefers `feeValue`; otherwise the largest fee-like bigint. */
export function feeOf(quote: any): bigint {
  const toBig = (v: unknown): bigint => { try { return typeof v === "bigint" ? v : typeof v === "number" || typeof v === "string" ? BigInt(v) : 0n; } catch { return 0n; } };
  if (quote?.feeValue !== undefined) return toBig(quote.feeValue);
  let best = 0n;
  const walk = (o: any, key = "", depth = 0) => {
    if (depth > 4 || o == null) return;
    if (typeof o === "object") for (const k of Object.keys(o)) walk(o[k], k, depth + 1);
    else if (/fee/i.test(key)) { const n = toBig(o); if (n > best) best = n; }
  };
  walk(quote);
  return best;
}
