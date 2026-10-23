import { useState } from "react";
import { Link } from "react-router-dom";
import { useData, statusMeta, type Status } from "../lib/data";
import { useWallet } from "../lib/wallet";
import { formatGen, same } from "../lib/chain";
import { Empty, StatusPill } from "../components/ui";

const ORDER: Status[] = ["PENDING", "IN_REVIEW", "NEEDS_EVIDENCE", "RELEASED", "PARTIAL", "REJECTED", "CANCELLED", "EXPIRED"];
const COLORS: Record<string, string> = { muted: "#717171", red: "#f00", amber: "#f5a524", green: "#2ba640" };

export default function Studio() {
  const data = useData(), w = useWallet();
  const [scope, setScope] = useState<"all" | "funding" | "receiving">("all");
  const grants = data.grants.filter((g) => scope === "all" || (scope === "funding" ? same(g.funder, w.address) : same(g.grantee, w.address)));
  const ids = new Set(grants.map((g) => g.id));
  const ms = data.milestones.filter((m) => ids.has(m.grant_id));
  const sum = (f: (g: (typeof grants)[number]) => string) => grants.reduce((s, g) => s + BigInt(f(g)), 0n);
  const total = sum((g) => g.total), released = sum((g) => g.released), refunded = sum((g) => g.refunded), locked = total - released - refunded;
  const counts = ORDER.map((s) => ({ s, n: ms.filter((m) => m.status === s).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const segs = [["Released", released, "#2ba640"], ["Refunded", refunded, "#f5a524"], ["Locked", locked, "#3ea6ff"]] as const;
  const tot = Number(total) || 1; let acc = 0;
  const scored = ms.filter((m) => m.verdict && m.verdict !== "EXPIRED");
  const avg = scored.length ? Math.round(scored.reduce((s, m) => s + m.payout_pct, 0) / scored.length) : 0;

  return (
    <div className="studio">
      <div className="studio-head"><h1>Studio</h1>
        <div className="chips">{(["all", "funding", "receiving"] as const).map((k) => <button key={k} className={`chip ${scope === k ? "on" : ""}`} onClick={() => { if (k !== "all" && !w.address) { w.connect(); return; } setScope(k); }}>{k === "all" ? "Whole network" : k === "funding" ? "I fund" : "I receive"}</button>)}
          <button className="chip" onClick={data.refresh} disabled={data.loading}>{data.loading ? "Refreshing…" : "Refresh"}</button></div></div>
      {grants.length === 0 ? <Empty title="Nothing to show yet" body="Create a grant, or switch to the whole network."><Link to="/create" className="btn primary">Create grant</Link></Empty> : (
        <>
          <div className="stats">
            {[["Escrowed", `${formatGen(total, 2)} GEN`], ["Released to grantees", `${formatGen(released, 2)} GEN`], ["Refunded to funders", `${formatGen(refunded, 2)} GEN`], ["Average payout band", scored.length ? `${avg}%` : "–"]].map(([k, v]) => <div key={k} className="stat"><small className="muted">{k}</small><b>{v}</b></div>)}
          </div>
          <div className="charts">
            <section className="panel"><h3>Milestones by status</h3>
              <svg viewBox="0 0 420 200" className="bars" role="img" aria-label="Milestones by status">
                {counts.map((c, i) => { const h = (c.n / max) * 130; const x = 14 + i * 58; return <g key={c.s}><rect x={x} y={150 - h} width="40" height={Math.max(h, 2)} rx="4" fill={COLORS[statusMeta[c.s].tone]} /><text x={x + 20} y={144 - h} textAnchor="middle" fontSize="12" fill="currentColor">{c.n}</text><text x={x + 20} y="172" textAnchor="middle" fontSize="9" fill="currentColor" opacity=".7">{statusMeta[c.s].label.split(" ")[0]}</text></g>; })}
              </svg></section>
            <section className="panel"><h3>Where the GEN is</h3>
              <div className="donut-wrap"><svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Funds breakdown"><circle cx="60" cy="60" r="44" fill="none" stroke="rgba(128,128,128,.2)" strokeWidth="16" />
                {segs.map(([n, v, c]) => { const len = (Number(v) / tot) * 276.46; const el = <circle key={n} cx="60" cy="60" r="44" fill="none" stroke={c} strokeWidth="16" strokeDasharray={`${len} 276.46`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" />; acc += len; return el; })}
                <text x="60" y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">{Math.round((Number(released) / tot) * 100)}%</text></svg>
                <ul className="legend">{segs.map(([n, v, c]) => <li key={n}><i style={{ background: c }} />{n}<b>{formatGen(v, 2)}</b></li>)}</ul></div></section>
          </div>
          <section className="panel"><h3>Latest milestones</h3>
            <div className="table-wrap"><table><thead><tr><th>Milestone</th><th>Grant</th><th>Status</th><th>Amount</th><th>Payout</th></tr></thead>
              <tbody>{[...ms].sort((a, b) => b.id - a.id).slice(0, 12).map((m) => <tr key={m.id}><td>{m.title}</td><td><Link className="link" to={`/grant/${m.grant_id}`}>#{m.grant_id}</Link></td><td><StatusPill status={m.status} /></td><td>{formatGen(m.amount, 3)} GEN</td><td>{m.verdict ? `${m.payout_pct}%` : "–"}</td></tr>)}</tbody></table></div></section>
        </>
      )}
    </div>
  );
}
