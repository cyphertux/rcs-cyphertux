"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectWallet,
  waitForUnisat,
  type SignPsbtOptions,
  type WalletAdapter,
} from "./unisat";

type WalletState = {
  connected: boolean;
  address: string | null;
  balanceSats: number;
  walletLabel: string | null;
  error: string | null;
  available: boolean;
  /** Connect and return fresh balance (avoids stale React state). */
  connect: () => Promise<{ address: string; balanceSats: number }>;
  /** Fetch balance from Unisat and return it. */
  refresh: () => Promise<number>;
  disconnect: () => void;
  getPublicKey: () => Promise<string>;
  signPsbt: (psbtBase64: string, options?: SignPsbtOptions) => Promise<string>;
  pushPsbt: (psbtOrTxHex: string) => Promise<string>;
  adapter: WalletAdapter | null;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProviderRoot({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balanceSats, setBalanceSats] = useState(0);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void waitForUnisat(5000)
      .then(async () => {
        if (cancelled) return;
        setAvailable(true);
        const w = detectWallet();
        setAdapter(w);
        // Restore session if Unisat already authorized this site
        try {
          const unisat = window.unisat;
          if (!unisat?.getAccounts || !w) return;
          const accounts = await unisat.getAccounts();
          const addr = accounts[0];
          if (!addr) return;
          const bal = await w.getBalance().catch(() => 0);
          if (cancelled) return;
          setAddress(addr);
          setBalanceSats(bal);
          setWalletLabel(w.label);
        } catch {
          /* not previously connected */
        }
      })
      .catch(() => {
        if (!cancelled) setAvailable(Boolean(detectWallet()));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep app in sync when Unisat locks / switches account
  useEffect(() => {
    let remove: (() => void) | undefined;
    void waitForUnisat(5000)
      .then((unisat) => {
        if (!unisat?.on) return;
        const onAccounts = (...args: unknown[]) => {
          const accounts = (args[0] as string[] | undefined) ?? [];
          if (!accounts.length) {
            setAddress(null);
            setBalanceSats(0);
            setWalletLabel(null);
            return;
          }
          const addr = accounts[0]!;
          setAddress(addr);
          const w = detectWallet();
          if (w) {
            setAdapter(w);
            setWalletLabel(w.label);
            void w.getBalance().then((bal) => setBalanceSats(bal));
          }
        };
        unisat.on("accountsChanged", onAccounts);
        remove = () => {
          const u = window.unisat as
            | {
                removeListener?: (
                  e: string,
                  h: (...a: unknown[]) => void,
                ) => void;
              }
            | undefined;
          u?.removeListener?.("accountsChanged", onAccounts);
        };
      })
      .catch(() => undefined);
    return () => remove?.();
  }, []);

  const refresh = useCallback(async () => {
    const w = adapter ?? detectWallet();
    if (!w) return 0;
    try {
      // Don't rely on React address state — may be stale right after connect()
      await w.getAddress();
      const bal = await w.getBalance();
      setBalanceSats(bal);
      return bal;
    } catch (e) {
      setError(e instanceof Error ? e.message : "BALANCE ERROR");
      return 0;
    }
  }, [adapter]);

  const connect = useCallback(async () => {
    setError(null);
    const w =
      detectWallet() ?? (await waitForUnisat().then(() => detectWallet()));
    if (!w) {
      setError("NO WALLET — INSTALL / UNLOCK UNISAT");
      throw new Error("NO WALLET — INSTALL / UNLOCK UNISAT");
    }
    const addr = await w.connect();
    let bal = 0;
    try {
      bal = await w.getBalance();
    } catch {
      bal = 0;
    }
    setAdapter(w);
    setAddress(addr);
    setWalletLabel(w.label);
    setAvailable(true);
    setBalanceSats(bal);
    return { address: addr, balanceSats: bal };
  }, []);

  const disconnect = useCallback(() => {
    void adapter?.disconnect();
    setAdapter(null);
    setAddress(null);
    setBalanceSats(0);
    setWalletLabel(null);
  }, [adapter]);

  const getPublicKey = useCallback(async () => {
    const w = adapter ?? detectWallet();
    if (!w || !address) throw new Error("WALLET NOT CONNECTED — TYPE CONNECT");
    if (!w.getPublicKey) {
      throw new Error("WALLET PUBKEY UNAVAILABLE — UPDATE UNISAT");
    }
    return w.getPublicKey();
  }, [adapter, address]);

  const signPsbt = useCallback(
    async (psbtBase64: string, options?: SignPsbtOptions) => {
      const w = adapter ?? detectWallet();
      if (!w || !address) throw new Error("WALLET NOT CONNECTED — TYPE CONNECT");
      return w.signPsbt(psbtBase64, options);
    },
    [adapter, address],
  );

  const pushPsbt = useCallback(
    async (psbtOrTxHex: string) => {
      const w = adapter ?? detectWallet();
      if (!w || !address) throw new Error("WALLET NOT CONNECTED — TYPE CONNECT");
      if (!w.pushPsbt) throw new Error("WALLET PUSH UNAVAILABLE — UPDATE UNISAT");
      return w.pushPsbt(psbtOrTxHex);
    },
    [adapter, address],
  );

  const value = useMemo<WalletState>(
    () => ({
      connected: Boolean(address),
      address,
      balanceSats,
      walletLabel,
      error,
      available,
      connect,
      refresh,
      disconnect,
      getPublicKey,
      signPsbt,
      pushPsbt,
      adapter,
    }),
    [
      address,
      adapter,
      available,
      balanceSats,
      connect,
      disconnect,
      error,
      getPublicKey,
      pushPsbt,
      refresh,
      signPsbt,
      walletLabel,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet outside WalletProviderRoot");
  return ctx;
}
