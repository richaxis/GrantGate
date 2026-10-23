import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData, isDone, statusMeta, type Milestone } from "../lib/data";
import { useWallet } from "../lib/wallet";
import { useTx } from "../lib/tx";
import { useToast } from "../lib/toast";
import { EXPLORER, formatGen, same, short } from "../lib/chain";
import { Avatar, Empty, GrantCard, StatusPill, Thumb, progress } from "../components/ui";

export default function Watch() {
  const { id } = useParams();
  const data = useData();
  const w = useWallet();
  const tx = useTx();
  const toast = useToast();
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const grant = data.grants.find((g) => String(g.id) === id);
  if (!grant) return data.loading ? <p className="muted pad">Loading grant…</p> : <Empty title="Grant not found" body="It may not exist on this network."><Link to="/" className="btn primary">Back to home</Link></Empty>;

  const ms = data.msOf(grant);
  const isFunder = same(w.address, grant.funder), isGrantee = same(w.address, grant.grantee);
  const locked = ms.filter((m) => !isDone(m.status)).reduce((s, m) => s + BigInt(m.amount), 0n);
  const done = () => data.refresh();
  const jump = (m: Milestone) => document.getElementById(`ms-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const needWallet = () => { toast("Connect your wallet to continue.", "error"); w.connect(); };

  function submit(m: Milestone) {
    if (!w.address) return needWallet();
    if (!/^https:\/\/\S+$/.test(url.trim())) return toast("Enter a public https:// proof URL.", "error");
    tx({ method: "submit_milestone", args: [BigInt(m.id), url.trim(), note.trim()], title: "Submit proof", detail: `Proof for “${m.title}”. Validators will fetch this URL during review.`, onDone: () => { setOpen(null); setUrl(""); setNote(""); done(); } });
  }
  const review = (m: Milestone) => (w.address ? tx({ method: "review_milestone", args: [BigInt(m.id)], title: "Run consensus review", detail: `Validators fetch the proof for “${m.title}” and judge it against the criteria. Payout follows deterministically.`, onDone: done }) : needWallet());
  const nowS = Math.floor(Date.now() / 1000);
  const expired = (m: Milestone) => !isDone(m.status) && m.deadline > 0 && nowS > m.deadline;
  const reclaim = (m: Milestone) => (w.address ? tx({ method: "reclaim_expired", args: [BigInt(m.id)], title: "Reclaim expired milestone", detail: `The deadline passed. Refunds ${formatGen(m.amount)} GEN to the funder.`, onDone: done }) : needWallet());

  return (
    <div className="watch">
      <div className="primary-col">
        <div className="player"><Thumb grant={grant} ms={ms} large />
          <div className="chapters" aria-label="Milestones">{ms.map((m) => <button key={m.id} className={`seg ${m.status}`} title={`${m.position}. ${m.title} · ${statusMeta[m.status].label}`} aria-label={`Milestone ${m.position}: ${m.title}`} onClick={() => jump(m)} />)}</div>
        </div>
        <h1 className="watch-title">{grant.title}</h1>
        <div className="channel">
          <Avatar seed={grant.funder} size={40} />
          <div><b>Funded by {short(grant.funder)}</b><small className="muted">For {short(grant.grantee)}{isFunder ? " · you are the funder" : isGrantee ? " · you are the grantee" : ""}</small></div>
          <div className="spacer" />
          <button className="btn tonal" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast("Link copied", "ok"); }}>Share</button>
          <a className="btn tonal" href={`${EXPLORER}/address/${grant.funder}`} target="_blank" rel="noreferrer">Explorer</a>
        </div>
        <div className="desc" onClick={() => !more && setMore(true)}>
          <b>{formatGen(grant.total, 2)} GEN escrowed · {progress(ms)}% complete</b>
          <p className={more ? "" : "clamp2"}>{grant.summary || "No description provided."}</p>
          {more && <dl className="facts"><dt>Released</dt><dd>{formatGen(grant.released, 4)} GEN</dd><dt>Refunded</dt><dd>{formatGen(grant.refunded, 4)} GEN</dd><dt>Still locked</dt><dd>{formatGen(locked, 4)} GEN</dd><dt>Grantee</dt><dd>{grant.grantee}</dd></dl>}
          <button className="link-btn" onClick={(e) => { e.stopPropagation(); setMore(!more); }}>{more ? "Show less" : "…more"}</button>
        </div>
        <h2 className="section">{ms.length} milestones</h2>
        <ul className="ms-list">
          {ms.map((m) => (
            <li key={m.id} id={`ms-${m.id}`} className="ms">
              <span className="ms-n">{m.position}</span>
              <div className="ms-body">
                <div className="ms-top"><b>{m.title}</b><StatusPill status={m.status} /><span className="amt">{formatGen(m.amount, 3)} GEN</span></div>
                <p className="muted">{m.criteria}</p>
                {!isDone(m.status) && m.deadline > 0 && <p className="small muted">{expired(m) ? "Deadline passed. The funder can reclaim this milestone." : `Deadline ${new Date(m.deadline * 1000).toLocaleString()} · ${m.status === "IN_REVIEW" ? "anyone can run the review before then" : "the grantee must act before then"}`}</p>}
                {m.proof_url && <p className="small">Proof: <a className="link" href={m.proof_url} target="_blank" rel="noreferrer">{m.proof_url}</a></p>}
                {m.verdict && <div className="verdict"><b>{m.verdict.replace(/_/g, " ")} · {m.payout_pct}% payout band</b><p>{m.reasoning}</p><small className="muted">Evidence digest {m.evidence_digest.slice(0, 12)}… · round {m.rounds}/2{BigInt(m.paid) > 0n ? ` · paid ${formatGen(m.paid, 3)} GEN` : ""}{BigInt(m.refunded) > 0n ? ` · refunded ${formatGen(m.refunded, 3)} GEN` : ""}</small>{(m.history ?? []).length > 0 && <details className="history"><summary>Review history ({m.history.length})</summary><ol>{m.history.map((h, i) => <li key={i}><b>{h.event ?? h.outcome}</b>{h.payout_pct !== undefined ? ` · ${h.payout_pct}%` : ""}{h.ref ? ` · ref ${h.ref.slice(0, 8)}` : ""}{h.truncated ? " · evidence truncated" : ""} · {new Date(h.at * 1000).toLocaleString()}{h.reasoning ? <p className="muted">{h.reasoning}</p> : null}</li>)}</ol></details>}</div>}
                <div className="row-actions">
                  {(m.status === "PENDING" || m.status === "NEEDS_EVIDENCE") && !expired(m) && (isGrantee || !w.address) && <button className="btn tonal" onClick={() => (w.address ? setOpen(open === m.id ? null : m.id) : needWallet())}>{m.status === "NEEDS_EVIDENCE" ? "Add evidence" : "Submit proof"}</button>}
                  {m.status === "IN_REVIEW" && <button className="btn primary" onClick={() => review(m)}>Run review</button>}
                  {expired(m) && isFunder && <button className="btn primary" onClick={() => reclaim(m)}>Reclaim expired</button>}
                </div>
                {open === m.id && (
                  <div className="inline-form">
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/you/project or a public demo URL" aria-label="Proof URL" />
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should validators look for? (optional)" rows={2} maxLength={600} aria-label="Note" />
                    <div className="row-actions"><button className="btn primary" onClick={() => submit(m)}>Submit proof</button><button className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="up-next"><h3>Up next</h3>{data.grants.filter((g) => g.id !== grant.id).slice(0, 6).map((g) => <GrantCard key={g.id} grant={g} ms={data.msOf(g)} />)}</aside>
    </div>
  );
}
