import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { useData } from "../lib/data";
import { CONTRACT, EXPLORER, short, same } from "../lib/chain";
import { useToast } from "../lib/toast";
import { Avatar } from "./ui";

const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
const I = {
  menu: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z", home: "M12 4.33l7 6.12V20h-4v-6H9v6H5v-9.55l7-6.12M12 2L3 9.8V22h8v-6h2v6h8V9.8L12 2z",
  studio: "M4 20h4V9H4v11zm6 0h4V4h-4v16zm6 0h4v-7h-4v7z", queue: "M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z", mine: "M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z", search: "M20.9 19.5l-4.6-4.6a7 7 0 10-1.4 1.4l4.6 4.6 1.4-1.4zM5 10a5 5 0 1110 0 5 5 0 01-10 0z",
  bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 00-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2z",
};

export default function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const toast = useToast();
  const w = useWallet();
  const data = useData();
  const [mini, setMini] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [menu, setMenu] = useState<"" | "bell" | "me">("");
  const [light, setLight] = useState(() => { try { return localStorage.getItem("grantgate:theme") === "light"; } catch { return false; } });
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = light ? "light" : "dark"; try { localStorage.setItem("grantgate:theme", light ? "light" : "dark"); } catch { /* ignore */ } }, [light]);
  useEffect(() => { setDrawer(false); setMenu(""); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (menu && pop.current && !pop.current.contains(e.target as Node)) setMenu(""); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const todo = data.milestones.filter((m) => {
    const g = data.grants.find((x) => x.id === m.grant_id);
    return g && ((m.status === "IN_REVIEW") || (same(g.grantee, w.address) && (m.status === "NEEDS_EVIDENCE")));
  });

  const links: [string, string, string][] = [["/", "Home", I.home], ["/reviews", "Review queue", I.queue], ["/studio", "Studio", I.studio], ["/?f=mine", "My grants", I.mine], ["/create", "Create grant", I.plus]];
  const side = (
    <nav className="side-nav">
      {links.map(([to, label, d]) => {
        const active = to === "/?f=mine" ? loc.pathname === "/" && params.get("f") === "mine" : to === "/" ? loc.pathname === "/" && !params.get("f") : loc.pathname === to;
        return <Link key={label} to={to} className={`side-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Ico d={d} /><span>{label}</span></Link>;
      })}
      <div className="side-foot"><p>Studio Next · chain 61997</p><a href={EXPLORER} target="_blank" rel="noreferrer">Explorer</a>{CONTRACT && <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">Contract {short(CONTRACT)}</a>}</div>
    </nav>
  );

  return (
    <div className={`shell ${mini ? "mini" : ""}`}>
      <header className="topbar">
        <div className="left">
          <button className="icon-btn" aria-label="Toggle menu" onClick={() => (window.innerWidth < 900 ? setDrawer((d) => !d) : setMini((m) => !m))}><Ico d={I.menu} /></button>
          <Link to="/" className="logo" aria-label="GrantGate home"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><defs><linearGradient id="gg-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#gg-logo)"/><path d="M8 25V15a8 8 0 0 1 16 0v10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="19" r="2.6" fill="#fff"/></svg><span>GrantGate</span></Link>
        </div>
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); nav(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/"); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search grants, funders, grantees" aria-label="Search grants" />
          {q && <button type="button" className="icon-btn sm" aria-label="Clear search" onClick={() => { setQ(""); nav("/"); }}>✕</button>}
          <button className="search-btn" aria-label="Search" type="submit"><Ico d={I.search} /></button>
        </form>
        <div className="right" ref={pop}>
          <Link to="/create" className="btn pill-btn"><Ico d={I.plus} /><span className="hide-s">Create</span></Link>
          <div className="rel">
            <button className="icon-btn" aria-label="Notifications" onClick={() => setMenu(menu === "bell" ? "" : "bell")}><Ico d={I.bell} />{todo.length > 0 && <b className="dot">{todo.length}</b>}</button>
            {menu === "bell" && (
              <div className="popover"><h4>Notifications</h4>
                {todo.length === 0 ? <p className="muted pad">You're all caught up.</p> : todo.slice(0, 6).map((m) => <Link key={m.id} to={`/grant/${m.grant_id}`} className="pop-item"><span>{m.title}</span><small className="muted">{m.status === "IN_REVIEW" ? "Waiting for review" : "Needs more evidence"}</small></Link>)}
              </div>
            )}
          </div>
          {w.address ? (
            <div className="rel">
              <button className="avatar-btn" aria-label="Account menu" onClick={() => setMenu(menu === "me" ? "" : "me")}><Avatar seed={w.address} size={32} /></button>
              {menu === "me" && (
                <div className="popover me">
                  <div className="me-head"><Avatar seed={w.address} size={40} /><div><b>{short(w.address)}</b><small className="muted">{w.balance ?? "…"} GEN{w.wrongChain ? " · wrong network" : ""}</small></div></div>
                  <button className="pop-item" onClick={() => { navigator.clipboard?.writeText(w.address!); toast("Address copied", "ok"); setMenu(""); }}>Copy address</button>
                  <a className="pop-item" href={`${EXPLORER}/address/${w.address}`} target="_blank" rel="noreferrer">View in explorer</a>
                  <Link className="pop-item" to="/studio">Open Studio</Link>
                  <button className="pop-item" onClick={() => setLight((l) => !l)}>Appearance: {light ? "Light" : "Dark"}</button>
                  <button className="pop-item danger" onClick={() => { setMenu(""); w.disconnect(); }}>Disconnect wallet</button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn signin" onClick={w.connect} disabled={w.connecting}>{w.connecting ? "Connecting…" : "Connect wallet"}</button>
          )}
        </div>
      </header>
      <aside className={`sidebar ${drawer ? "open" : ""}`}>{side}</aside>
      {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}
      <main className="content">
        {w.address && w.wrongChain && <div className="banner">Your wallet is on another network. <button className="link-btn" onClick={w.connect}>Switch to Studio Next</button></div>}
        {data.demo && <div className="banner info">Demo data is showing because <code>VITE_GRANTGATE_CONTRACT</code> is not set. Deploy the contract and set the address to go live.</div>}
        {data.error && <div className="banner">{data.error} <button className="link-btn" onClick={data.refresh}>Retry</button></div>}
        <Outlet />
      </main>
    </div>
  );
}
