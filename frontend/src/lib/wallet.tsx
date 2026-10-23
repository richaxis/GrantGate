import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CHAIN_HEX, ensureChain, errText, formatGen } from "./chain";
import { useToast } from "./toast";

type W = { address?: string; connecting: boolean; wrongChain: boolean; balance?: string; connect(): Promise<void>; disconnect(): Promise<void> };
const Ctx = createContext<W | null>(null);
const FLAG = "grantgate:disconnected";
const flagged = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [address, setAddress] = useState<string>();
  const [connecting, setConnecting] = useState(false);
  const [wrongChain, setWrongChain] = useState(false);
  const [balance, setBalance] = useState<string>();

  const sync = useCallback(async (addr?: string) => {
    setAddress(addr);
    if (!addr || !window.ethereum) { setBalance(undefined); setWrongChain(false); return; }
    try {
      const id = String(await window.ethereum.request({ method: "eth_chainId" }));
      setWrongChain(id.toLowerCase() !== CHAIN_HEX);
      const b = String(await window.ethereum.request({ method: "eth_getBalance", params: [addr, "latest"] }));
      setBalance(formatGen(BigInt(b), 3));
    } catch { /* balance is cosmetic */ }
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    if (!flagged()) eth.request({ method: "eth_accounts" }).then((a) => sync((a as string[])[0])).catch(() => {});
    const onAccounts = (a: string[]) => { if (!flagged()) sync(a[0]); };
    const onChain = () => { if (address) sync(address); };
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => { eth.removeListener?.("accountsChanged", onAccounts); eth.removeListener?.("chainChanged", onChain); };
  }, [sync, address]);

  const connect = useCallback(async () => {
    if (!window.ethereum) { toast("No wallet found. Install MetaMask, then reload.", "error"); return; }
    setConnecting(true);
    try {
      const a = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      await ensureChain();
      try { localStorage.removeItem(FLAG); } catch { /* ignore */ }
      await sync(a[0]);
      toast("Wallet connected", "ok");
    } catch (e) { toast(errText(e, "Connection was cancelled"), "error"); }
    finally { setConnecting(false); }
  }, [sync, toast]);

  const disconnect = useCallback(async () => {
    try { await window.ethereum?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }); } catch { /* not supported by every wallet */ }
    try { localStorage.setItem(FLAG, "1"); } catch { /* ignore */ }
    await sync(undefined);
    toast("Wallet disconnected", "ok");
  }, [sync, toast]);

  const value = useMemo(() => ({ address, connecting, wrongChain, balance, connect, disconnect }), [address, connecting, wrongChain, balance, connect, disconnect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useWallet = () => { const c = useContext(Ctx); if (!c) throw new Error("WalletProvider missing"); return c; };
