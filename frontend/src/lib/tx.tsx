import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isSuccessful } from "genlayer-js";
import { CONTRACT, EXPLORER, errText, feeOf, findFees, formatGen, makeKit, writeClient } from "./chain";
import { useWallet } from "./wallet";
import { useToast } from "./toast";

export type TxSpec = { method: string; args: unknown[]; value?: bigint; title: string; detail?: string; onDone?: () => void };
type Preset = "low" | "standard" | "high";
type Stage = "estimating" | "review" | "signing" | "tracking" | "pending" | "done" | "error";

const Ctx = createContext<(tx: TxSpec) => void>(() => {});
export const useTx = () => useContext(Ctx);

export function TxProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const toast = useToast();
  const [tx, setTx] = useState<TxSpec | null>(null);
  const request = useCallback((spec: TxSpec) => {
    if (!CONTRACT) { toast("Set VITE_GRANTGATE_CONTRACT to your deployed contract address first.", "error"); return; }
    if (!wallet.address) { toast("Connect your wallet first.", "error"); wallet.connect(); return; }
    setTx(spec);
  }, [wallet, toast]);
  return <Ctx.Provider value={request}>{children}{tx && <TxModal key={tx.method + Date.now()} spec={tx} address={wallet.address!} onClose={() => setTx(null)} />}</Ctx.Provider>;
}

function TxModal({ spec, address, onClose }: { spec: TxSpec; address: string; onClose: () => void }) {
  const [preset, setPreset] = useState<Preset>("standard");
  const [stage, setStage] = useState<Stage>("estimating");
  const [quote, setQuote] = useState<any>();
  const [fee, setFee] = useState(0n);
  const [msg, setMsg] = useState("");
  const [hash, setHash] = useState("");
  const kit = useRef<any>(null);
  const body = { kind: "write", address: CONTRACT, method: spec.method, args: spec.args, ...(spec.value ? { value: spec.value } : {}) } as any;

  useEffect(() => {
    let alive = true;
    setStage("estimating"); setMsg("");
    (async () => {
      try {
        kit.current = kit.current ?? makeKit(address);
        const q = await kit.current.estimate({ preset }, body);
        if (import.meta.env.DEV) console.debug("fee quote", q);
        const f = feeOf(q);
        if (!alive) return;
        setQuote(q); setFee(f);
        if (f <= 0n) { setStage("error"); setMsg("The network quoted a zero fee. GrantGate only submits writes that carry a non-zero fee, so nothing was sent."); return; }
        if (q?.verification?.status === "mismatch") { setStage("error"); setMsg("The fee policy changed since this quote. Close and try again."); return; }
        setStage("review");
      } catch (e) { if (alive) { setStage("error"); setMsg(errText(e, "Could not estimate the fee")); } }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const clientRef = useRef<any>(null);
  const idRef = useRef<any>(null);

  async function watch() {
    setStage("tracking"); setMsg("Waiting for validators…");
    try {
      const client = clientRef.current;
      const wait = client.waitForDecision ?? client.waitForFinalization;
      const receipt = await wait.call(client, { hash: idRef.current, interval: 5000, retries: 120 });
      if (!isSuccessful(receipt)) {
        const st = receipt?.statusName ?? receipt?.status_name ?? receipt?.status ?? "unknown";
        throw new Error(`The network did not accept this transaction (status ${st}). If validators could not agree, nothing changed and you can retry. Open the explorer link for details.`);
      }
      setStage("done"); setMsg("Confirmed on-chain."); spec.onDone?.();
    } catch (e) {
      if (/timed out|timeout/i.test(errText(e))) {
        setStage("pending");
        setMsg("Still pending on the network. This is not a failure: validators have not picked it up yet, and nothing has moved. Do not send it again. Check the explorer link, then press Check again.");
      } else { setStage("error"); setMsg(errText(e, "Transaction failed")); }
    }
  }

  async function confirm() {
    setStage("signing"); setMsg("Approve the transaction in your wallet…");
    try {
      const fees = findFees(quote);
      if (import.meta.env.DEV) console.debug("submitting fees", fees);
      if (!fees) throw new Error("Could not read the fee distribution from the quote, so nothing was sent.");
      if (fees.feeValue <= 0n) throw new Error("Refusing to submit a write with a zero fee.");
      clientRef.current = await writeClient(address);
      idRef.current = await clientRef.current.writeContract({ address: CONTRACT, functionName: spec.method, args: spec.args, value: spec.value ?? 0n, fees });
      setHash(String(idRef.current));
      await watch();
    } catch (e) { setStage("error"); setMsg(errText(e, "Transaction failed")); }
  }

  const busy = stage === "signing" || stage === "tracking";
  const total = fee + (spec.value ?? 0n);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={spec.title}>
        <div className="modal-head"><h2>{spec.title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button></div>
        {spec.detail && <p className="muted">{spec.detail}</p>}
        <div className="receipt">
          <div><span>Fee deposit</span><b>{stage === "estimating" ? "Estimating…" : `${formatGen(fee, 6)} GEN`}</b></div>
          {spec.value ? <div><span>Value sent to contract</span><b>{formatGen(spec.value, 6)} GEN</b></div> : null}
          <div className="total"><span>Wallet total</span><b>{stage === "estimating" ? "…" : `${formatGen(total, 6)} GEN`}</b></div>
          <small className="muted">Unused fee budget is refunded when the transaction finalizes.</small>
        </div>
        <div className="presets" role="group" aria-label="Appeal posture">
          {(["low", "standard", "high"] as Preset[]).map((p) => (
            <button key={p} className={`chip ${preset === p ? "on" : ""}`} disabled={busy || stage === "done"} onClick={() => setPreset(p)}>{p === "low" ? "Low · 1 appeal round" : p === "standard" ? "Standard · 3" : "High · 5"}</button>
          ))}
        </div>
        {msg && <p className={`tx-msg ${stage}`}>{msg}</p>}
        {hash && <a className="link" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View in explorer</a>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>{stage === "done" ? "Close" : "Cancel"}</button>
          {stage === "pending" ? <button className="btn primary" onClick={watch}>Check again</button> : stage !== "done" && <button className="btn primary" disabled={stage !== "review"} onClick={confirm}>{busy ? "Working…" : "Confirm and sign"}</button>}
        </div>
      </div>
    </div>
  );
}
