import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useWallet } from "../lib/wallet";
import { useTx } from "../lib/tx";
import { formatGen } from "../lib/chain";
import { Empty, StatusPill } from "../components/ui";

export default function Reviews() {
  const data = useData(), w = useWallet(), tx = useTx();
  const rows = data.milestones.filter((m) => m.status === "IN_REVIEW" || m.status === "NEEDS_EVIDENCE");
  return (
    <div className="studio"><div className="studio-head"><h1>Review queue</h1><div className="chips"><button className="chip" onClick={data.refresh} disabled={data.loading}>{data.loading ? "Refreshing…" : "Refresh"}</button></div></div>
      <p className="muted">Anyone can trigger a review. Validators fetch the public proof and reach consensus; payout then follows deterministically.</p>
      {rows.length === 0 ? <Empty title="Queue is empty" body="Nothing is waiting for review right now." /> : (
        <ul className="ms-list">{rows.map((m) => (
          <li key={m.id} className="ms"><span className="ms-n">{m.position}</span>
            <div className="ms-body"><div className="ms-top"><b>{m.title}</b><StatusPill status={m.status} /><span className="amt">{formatGen(m.amount, 3)} GEN</span></div>
              <p className="muted">{m.criteria}</p>
              <div className="row-actions"><Link className="btn tonal" to={`/grant/${m.grant_id}`}>Open grant</Link>
                {m.status === "IN_REVIEW" && <button className="btn primary" onClick={() => (w.address ? tx({ method: "review_milestone", args: [BigInt(m.id)], title: "Run consensus review", detail: `Reviews “${m.title}”.`, onDone: data.refresh }) : w.connect())}>Run review</button>}</div></div></li>))}</ul>)}
    </div>
  );
}
