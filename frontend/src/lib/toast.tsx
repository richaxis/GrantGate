import { createContext, useCallback, useContext, useState } from "react";

type T = { id: number; text: string; tone: "ok" | "error" | "info" };
const Ctx = createContext<(text: string, tone?: T["tone"]) => void>(() => {});
let n = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: T["tone"] = "info") => {
    const id = ++n;
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>{t.text}</span>
            <button className="icon-btn sm" aria-label="Dismiss" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
