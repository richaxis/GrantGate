import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CONTRACT, readClient, same } from "./chain";

export type Status = "PENDING" | "IN_REVIEW" | "NEEDS_EVIDENCE" | "RELEASED" | "PARTIAL" | "REJECTED" | "CANCELLED" | "EXPIRED";
export type Review = { at: number; round?: number; event?: string; from?: string; outcome?: string; payout_pct?: number; digest?: string; ref?: string; truncated?: boolean; reasoning?: string; refund?: string };
export type Grant = { id: number; funder: string; grantee: string; title: string; summary: string; total: string; released: string; refunded: string; status: "ACTIVE" | "COMPLETED"; milestone_ids: number[] };
export type Milestone = { id: number; grant_id: number; position: number; title: string; criteria: string; amount: string; status: Status; proof_url: string; note: string; verdict: string; payout_pct: number; reasoning: string; evidence_digest: string; rounds: number; paid: string; refunded: string; deadline: number; history: Review[] };
export type Snapshot = { grants: Grant[]; milestones: Milestone[] };

export const statusMeta: Record<Status, { label: string; tone: string }> = {
  PENDING: { label: "Waiting for proof", tone: "muted" }, IN_REVIEW: { label: "In review", tone: "red" },
  NEEDS_EVIDENCE: { label: "Needs evidence", tone: "amber" }, RELEASED: { label: "Released", tone: "green" },
  PARTIAL: { label: "Partly released", tone: "green" }, REJECTED: { label: "Rejected · refunded", tone: "red" }, CANCELLED: { label: "Cancelled · refunded", tone: "muted" }, EXPIRED: { label: "Expired · refunded", tone: "muted" },
};
export const isDone = (s: Status) => ["RELEASED", "PARTIAL", "REJECTED", "CANCELLED", "EXPIRED"].includes(s);

const E = 10n ** 18n;
const demo: Snapshot = {
  grants: [
    { id: 9001, funder: "0xA11ce00000000000000000000000000000000001", grantee: "0xB0b0000000000000000000000000000000000002", title: "Open-source geocoder for East Africa", summary: "Fund a public geocoding API and dataset covering Ethiopia, Kenya and Uganda. Each milestone is released when validators confirm the public proof matches the criteria.", total: String(60n * E), released: String(20n * E), refunded: "0", status: "ACTIVE", milestone_ids: [9101, 9102, 9103] },
    { id: 9002, funder: "0xC4r0l00000000000000000000000000000000003", grantee: "0xD4v3000000000000000000000000000000000004", title: "Amharic speech dataset, 500 hours", summary: "Collect and publish a consented speech corpus with a datasheet and a baseline model.", total: String(90n * E), released: String(90n * E), refunded: "0", status: "COMPLETED", milestone_ids: [9201, 9202] },
    { id: 9003, funder: "0xE11e000000000000000000000000000000000005", grantee: "0xF4y3000000000000000000000000000000000006", title: "Zero-knowledge audit tooling", summary: "A CLI that turns circuit audits into reproducible reports.", total: String(40n * E), released: "0", refunded: "0", status: "ACTIVE", milestone_ids: [9301, 9302] },
  ],
  milestones: [
    { id: 9101, grant_id: 9001, position: 1, title: "Public API alpha", criteria: "A live HTTPS endpoint answers forward geocoding for Addis Ababa with documentation.", amount: String(20n * E), status: "RELEASED", proof_url: "https://example.com/api", note: "", verdict: "MET", payout_pct: 100, reasoning: "Endpoint and docs demonstrate every listed criterion.", evidence_digest: "9f2c…a1", rounds: 0, paid: String(20n * E), refunded: "0", deadline: 4102444800, history: [] },
    { id: 9102, grant_id: 9001, position: 2, title: "Dataset v1 on a public mirror", criteria: "A downloadable dataset with at least 100k named places and a license file.", amount: String(20n * E), status: "IN_REVIEW", proof_url: "https://example.com/dataset", note: "Mirror and license are live.", verdict: "", payout_pct: 0, reasoning: "", evidence_digest: "", rounds: 0, paid: "0", refunded: "0", deadline: 4102444800, history: [] },
    { id: 9103, grant_id: 9001, position: 3, title: "Accuracy report", criteria: "A published benchmark comparing results on 1,000 labelled addresses.", amount: String(20n * E), status: "PENDING", proof_url: "", note: "", verdict: "", payout_pct: 0, reasoning: "", evidence_digest: "", rounds: 0, paid: "0", refunded: "0", deadline: 4102444800, history: [] },
    { id: 9201, grant_id: 9002, position: 1, title: "Corpus and datasheet", criteria: "Public corpus with consent documentation and a datasheet.", amount: String(50n * E), status: "RELEASED", proof_url: "https://example.com/c", note: "", verdict: "MET", payout_pct: 100, reasoning: "All items present.", evidence_digest: "b7e1…09", rounds: 0, paid: String(50n * E), refunded: "0", deadline: 4102444800, history: [] },
    { id: 9202, grant_id: 9002, position: 2, title: "Baseline model", criteria: "Reproducible baseline with a published word error rate.", amount: String(40n * E), status: "RELEASED", proof_url: "https://example.com/m", note: "", verdict: "MET", payout_pct: 100, reasoning: "Reproducible and reported.", evidence_digest: "c3d4…7e", rounds: 1, paid: String(40n * E), refunded: "0", deadline: 4102444800, history: [] },
    { id: 9301, grant_id: 9003, position: 1, title: "CLI prototype", criteria: "A repository with a working CLI and a quickstart.", amount: String(15n * E), status: "NEEDS_EVIDENCE", proof_url: "https://example.com/cli", note: "", verdict: "NEEDS_EVIDENCE", payout_pct: 0, reasoning: "Quickstart is missing from the proof.", evidence_digest: "5aa0…c2", rounds: 1, paid: "0", refunded: "0", deadline: 4102444800, history: [] },
    { id: 9302, grant_id: 9003, position: 2, title: "Report template", criteria: "A sample audit report generated from the CLI.", amount: String(25n * E), status: "PENDING", proof_url: "", note: "", verdict: "", payout_pct: 0, reasoning: "", evidence_digest: "", rounds: 0, paid: "0", refunded: "0", deadline: 4102444800, history: [] },
  ],
};

type D = { grants: Grant[]; milestones: Milestone[]; loading: boolean; error?: string; demo: boolean; refresh(): Promise<void>; msOf(g: Grant): Milestone[]; mine(addr?: string): Grant[] };
const Ctx = createContext<D | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>({ grants: [], milestones: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refresh = useCallback(async () => {
    if (!CONTRACT) { setLoading(false); return; }
    setLoading(true); setError(undefined);
    try {
      const raw = await readClient().readContract({ address: CONTRACT, functionName: "snapshot", args: [] });
      setSnap(JSON.parse(String(raw)) as Snapshot);
    } catch (e: any) { setError(e?.message ? String(e.message).slice(0, 200) : "Could not reach Studio Next"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const isDemo = !CONTRACT;
  const value = useMemo<D>(() => {
    const s = isDemo ? demo : snap;
    const byId = new Map(s.milestones.map((m) => [m.id, m]));
    return {
      grants: [...s.grants].sort((a, b) => b.id - a.id), milestones: s.milestones, loading, error, demo: isDemo, refresh,
      msOf: (g) => g.milestone_ids.map((i) => byId.get(i)).filter(Boolean) as Milestone[],
      mine: (addr) => s.grants.filter((g) => same(g.funder, addr) || same(g.grantee, addr)),
    };
  }, [snap, loading, error, isDemo, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useData = () => { const c = useContext(Ctx); if (!c) throw new Error("DataProvider missing"); return c; };
