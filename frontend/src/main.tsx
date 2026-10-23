import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./lib/toast";
import { WalletProvider } from "./lib/wallet";
import { DataProvider } from "./lib/data";
import { TxProvider } from "./lib/tx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider><WalletProvider><DataProvider><TxProvider><App /></TxProvider></DataProvider></WalletProvider></ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
