import { Link } from "react-router-dom";
import type { Grant, Milestone } from "../lib/data";
import { isDone, statusMeta } from "../lib/data";
import { formatGen, short } from "../lib/chain";

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const hue = (s: string) => hash(s) % 360;

export function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const h = hue(seed);
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg,hsl(${h} 70% 48%),hsl(${(h + 50) % 360} 70% 38%))` }}>{(seed.replace(/^0x/, "")[0] || "?").toUpperCase()}</span>;
}

/** Generated thumbnail: milestones drawn as chapters on a route. Filled nodes are settled; the red node is in review. */
export function Thumb({ grant, ms, large }: { grant: Grant; ms: Milestone[]; large?: boolean }) {
  const h = hue(String(grant.id) + grant.title);
  const n = Math.max(ms.length, 1);
  const pts = Array.from({ length: n }, (_, i) => ({ x: 40 + (i * 240) / Math.max(n - 1, 1), y: 118 - Math.sin((i / Math.max(n - 1, 1)) * Math.PI * 1.2) * 46 - (i % 2) * 8 }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg className={`thumb-svg ${large ? "large" : ""}`} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${grant.title} milestone route`}>
      <defs>
        <linearGradient id={`g${grant.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={`hsl(${h} 62% 22%)`} /><stop offset="1" stopColor={`hsl(${(h + 70) % 360} 70% 12%)`} /></linearGradient>
        <pattern id={`p${grant.id}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.06)" /></pattern>
      </defs>
      <rect width="320" height="180" fill={`url(#g${grant.id})`} /><rect width="320" height="180" fill={`url(#p${grant.id})`} />
      <circle cx="270" cy="38" r="54" fill={`hsl(${(h + 30) % 360} 80% 55%)`} opacity=".12" />
      <polyline points={line} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
      {pts.map((p, i) => {
        const m = ms[i]; const done = m && isDone(m.status); const live = m && (m.status === "IN_REVIEW");
        return <g key={i}>{live && <circle className="pulse" cx={p.x} cy={p.y} r="9" fill="#f00" opacity=".35" />}<circle cx={p.x} cy={p.y} r="6" fill={done ? "#3ea6ff" : live ? "#f00" : "#0f0f0f"} stroke="#fff" strokeWidth="2" /></g>;
      })}
      <text x="16" y="34" fill="#fff" fontSize="20" fontWeight="700">{formatGen(grant.total, 2)} GEN</text>
      <text x="16" y="52" fill="rgba(255,255,255,.7)" fontSize="11">{ms.length} milestone{ms.length === 1 ? "" : "s"} · escrowed</text>
    </svg>
  );
}

export function progress(ms: Milestone[]) { return ms.length ? Math.round((ms.filter((m) => isDone(m.status)).length / ms.length) * 100) : 0; }

export function GrantCard({ grant, ms }: { grant: Grant; ms: Milestone[] }) {
  const inReview = ms.some((m) => m.status === "IN_REVIEW");
  const badge = grant.status === "COMPLETED" ? "Completed" : inReview ? "In review" : "";
  return (
    <Link to={`/grant/${grant.id}`} className="card">
      <div className="thumb">
        <Thumb grant={grant} ms={ms} />
        {badge && <span className={`badge ${inReview ? "live" : ""}`}>{badge}</span>}
        <span className="dur">{ms.length} milestones</span>
        <div className="watched"><i style={{ width: `${progress(ms)}%` }} /></div>
      </div>
      <div className="card-meta">
        <Avatar seed={grant.funder} />
        <div><h3 className="clamp2">{grant.title}</h3><p className="sub">{short(grant.funder)} → {short(grant.grantee)}</p><p className="sub">{formatGen(grant.released, 2)} of {formatGen(grant.total, 2)} GEN released · {progress(ms)}% done</p></div>
      </div>
    </Link>
  );
}

export function StatusPill({ status }: { status: Milestone["status"] }) { const m = statusMeta[status]; return <span className={`pill ${m.tone}`}>{m.label}</span>; }
export function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) { return <div className="empty"><h2>{title}</h2><p className="muted">{body}</p>{children}</div>; }
