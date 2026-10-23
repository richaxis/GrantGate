import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import { useWallet } from "../lib/wallet";
import { useTx } from "../lib/tx";
import { useToast } from "../lib/toast";
import { formatGen, parseGen, same } from "../lib/chain";

type Row = { title: string; criteria: string; amount: string };
const blank = (): Row => ({ title: "", criteria: "", amount: "" });

export default function Create() {
  const [title, setTitle] = useState(""), [summary, setSummary] = useState(""), [grantee, setGrantee] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const nav = useNavigate(), data = useData(), w = useWallet(), tx = useTx(), toast = useToast();
  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  let total = 0n; try { total = rows.reduce((s, r) => s + (r.amount ? parseGen(r.amount) : 0n), 0n); } catch { /* shown on submit */ }

  function go(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!w.address) { toast("Connect your wallet to fund a grant.", "error"); return w.connect(); }
      if (!title.trim()) throw new Error("Add a title.");
      if (!/^0x[0-9a-fA-F]{40}$/.test(grantee.trim())) throw new Error("Grantee must be a 0x wallet address.");
      if (same(grantee.trim(), w.address)) throw new Error("The grantee must be a different wallet from yours.");
      const items = rows.map((r, i) => {
        if (!r.title.trim() || !r.criteria.trim()) throw new Error(`Milestone ${i + 1} needs a title and acceptance criteria.`);
        const a = parseGen(r.amount); if (a <= 0n) throw new Error(`Milestone ${i + 1} needs an amount above 0.`);
        return { title: r.title.trim(), criteria: r.criteria.trim(), amount: a.toString() };
      });
      tx({ method: "create_grant", args: [title.trim(), summary.trim(), grantee.trim(), JSON.stringify(items)], value: items.reduce((s, i) => s + BigInt(i.amount), 0n), title: "Fund grant", detail: `Escrows ${items.length} milestone${items.length > 1 ? "s" : ""} in GEN. Funds only move after a consensus verdict.`, onDone: () => { data.refresh(); nav("/"); } });
    } catch (err: any) { toast(err.message, "error"); }
  }

  return (
    <form className="create" onSubmit={go}>
      <h1>Create grant</h1>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Open-source geocoder for East Africa" /></label>
      <label>Description<textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} rows={3} placeholder="What will be built and why it matters" /></label>
      <label>Grantee wallet<input value={grantee} onChange={(e) => setGrantee(e.target.value)} placeholder="0x…" spellCheck={false} /></label>
      <h2 className="section">Milestones</h2>
      {rows.map((r, i) => (
        <fieldset key={i} className="m-row"><legend>Milestone {i + 1}</legend>
          <input value={r.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Title" maxLength={120} aria-label={`Milestone ${i + 1} title`} />
          <textarea value={r.criteria} onChange={(e) => set(i, "criteria", e.target.value)} placeholder="Acceptance criteria validators will check against the public proof" rows={2} maxLength={600} aria-label={`Milestone ${i + 1} criteria`} />
          <div className="amt-row"><input value={r.amount} onChange={(e) => set(i, "amount", e.target.value)} placeholder="Amount" inputMode="decimal" aria-label={`Milestone ${i + 1} amount`} /><span>GEN</span>
            {rows.length > 1 && <button type="button" className="btn ghost" onClick={() => setRows((l) => l.filter((_, j) => j !== i))}>Remove</button>}</div>
        </fieldset>
      ))}
      <div className="row-actions"><button type="button" className="btn tonal" disabled={rows.length >= 8} onClick={() => setRows((l) => [...l, blank()])}>Add milestone</button></div>
      <div className="create-foot"><div><b>{formatGen(total, 4)} GEN</b><small className="muted"> escrowed, plus a network fee shown before you sign</small></div>
        <div className="row-actions"><Link to="/" className="btn ghost">Cancel</Link><button className="btn primary" type="submit">Review and fund</button></div></div>
    </form>
  );
}
