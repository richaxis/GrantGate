import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../lib/data";
import { useWallet } from "../lib/wallet";
import { Empty, GrantCard } from "../components/ui";

const CHIPS = [["", "All"], ["active", "Active"], ["review", "In review"], ["completed", "Completed"], ["mine", "Mine"]] as const;

export default function Home() {
  const [params, setParams] = useSearchParams();
  const f = params.get("f") ?? "";
  const q = (params.get("q") ?? "").toLowerCase();
  const data = useData();
  const w = useWallet();
  const mine = new Set(data.mine(w.address).map((g) => g.id));

  const rows = data.grants.filter((g) => {
    const ms = data.msOf(g);
    if (f === "active" && g.status !== "ACTIVE") return false;
    if (f === "completed" && g.status !== "COMPLETED") return false;
    if (f === "review" && !ms.some((m) => m.status === "IN_REVIEW")) return false;
    if (f === "mine" && !mine.has(g.id)) return false;
    return !q || `${g.title} ${g.summary} ${g.funder} ${g.grantee}`.toLowerCase().includes(q);
  });
  const set = (v: string) => { const n = new URLSearchParams(params); v ? n.set("f", v) : n.delete("f"); setParams(n); };

  return (
    <>
      <div className="chips" role="tablist" aria-label="Filter grants">
        {CHIPS.map(([v, label]) => <button key={label} role="tab" aria-selected={f === v} className={`chip ${f === v ? "on" : ""}`} onClick={() => set(v)}>{label}</button>)}
        <button className="chip" onClick={data.refresh} disabled={data.loading}>{data.loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {data.loading && data.grants.length === 0 ? (
        <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skeleton"><div className="thumb" /><div className="card-meta"><span className="avatar" /><div><h3>&nbsp;</h3><p className="sub">&nbsp;</p></div></div></div>)}</div>
      ) : rows.length === 0 ? (
        f === "mine" && !w.address ? <Empty title="Connect your wallet" body="Connect to see grants you fund or receive."><button className="btn primary" onClick={w.connect}>Connect wallet</button></Empty>
          : <Empty title={q || f ? "No grants match" : "No grants yet"} body={q || f ? "Try a different filter or search." : "Fund the first grant and release it milestone by milestone."}><Link to="/create" className="btn primary">Create grant</Link></Empty>
      ) : (
        <div className="grid">{rows.map((g) => <GrantCard key={g.id} grant={g} ms={data.msOf(g)} />)}</div>
      )}
    </>
  );
}
