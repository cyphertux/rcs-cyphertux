"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { createBitcoinProvider } from "./provider";
import type { BitcoinProvider } from "./types";

const BitcoinContext = createContext<BitcoinProvider | null>(null);

export function BitcoinProviderRoot({ children }: { children: ReactNode }) {
  const provider = useMemo(() => createBitcoinProvider(), []);
  return (
    <BitcoinContext.Provider value={provider}>{children}</BitcoinContext.Provider>
  );
}

export function useBitcoin(): BitcoinProvider {
  const ctx = useContext(BitcoinContext);
  if (!ctx) throw new Error("useBitcoin outside BitcoinProviderRoot");
  return ctx;
}
