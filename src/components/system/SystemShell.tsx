"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BitcoinProviderRoot, useBitcoin } from "@/bitcoin/BitcoinContext";
import { BootSequence } from "@/components/screens/BootSequence";
import { InstrumentFrame } from "@/components/instrument/InstrumentFrame";
import {
  DesktopOnlyGate,
  useIsMobileBlocked,
} from "@/components/system/DesktopOnlyGate";
import { useMachineStore } from "@/state/machineStore";
import { WalletProviderRoot } from "@/wallet/WalletContext";
import type { MemoryEntry } from "@/domain/memory";
import { clearLegacySkin } from "@/storage/local";
import styles from "./SystemShell.module.css";

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function Runtime() {
  const hydrate = useMachineStore((s) => s.hydrate);
  const hydrated = useMachineStore((s) => s.hydrated);
  const phase = useMachineStore((s) => s.phase);
  const tickClock = useMachineStore((s) => s.tickClock);
  const setStatus = useMachineStore((s) => s.setStatus);
  const setMemory = useMachineStore((s) => s.setMemory);
  const setReducedMotion = useMachineStore((s) => s.setReducedMotion);
  const bitcoin = useBitcoin();

  useEffect(() => {
    clearLegacySkin();
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setReducedMotion]);

  useEffect(() => {
    if (!hydrated) return;

    const applyChain = (s: Awaited<ReturnType<typeof bitcoin.getStatus>>) => {
      const prev = useMachineStore.getState().status;
      if (
        s.blockHeight > 0 &&
        prev.blockHeight > 0 &&
        s.blockHeight > prev.blockHeight
      ) {
        void import("@/audio/audioSystem").then(({ playCue }) =>
          playCue("beep"),
        );
      }
      if (prev.nodeStatus !== "OFFLINE" && s.nodeStatus === "OFFLINE") {
        void import("@/audio/audioSystem").then(({ playCue }) =>
          playCue("error"),
        );
      }
      setStatus({
        networkLabel: s.networkLabel,
        channel: s.channel,
        nodeStatus: s.nodeStatus,
        blockHeight: s.blockHeight,
        queueSize: s.queueSize,
        time: s.time,
        feeRateSatVb: s.feeRateSatVb,
        nextFeeSatVb: s.nextFeeSatVb,
        nextFeeMin: s.nextFeeMin,
        nextFeeMax: s.nextFeeMax,
        nextBlockTx: s.nextBlockTx,
        nextBlockVsize: s.nextBlockVsize,
        nextTotalFees: s.nextTotalFees,
        mempoolVsize: s.mempoolVsize,
        mempoolTotalFee: s.mempoolTotalFee,
        mempoolFill: s.mempoolFill,
        tipAgeSec: s.tipAgeSec,
        lastProbeAt: Date.now(),
      });
    };

    let tipFails = 0;

    const sync = async () => {
      try {
        applyChain(await bitcoin.getStatus());
        tipFails = 0;
      } catch {
        tipFails += 1;
        setStatus({ nodeStatus: "OFFLINE" });
      }
      try {
        const res = await fetch("/api/memory");
        const data = (await res.json()) as { entries?: MemoryEntry[] };
        if (data.entries) setMemory(data.entries);
      } catch {
        // index may be temporarily unavailable
      }
    };

    void sync();
    const id = window.setInterval(() => {
      void bitcoin
        .getBlockHeight()
        .then((h) => {
          tipFails = 0;
          tickClock(h);
        })
        .catch(() => {
          tipFails += 1;
          tickClock();
          if (tipFails >= 3) {
            setStatus({ nodeStatus: "OFFLINE" });
          }
        });
    }, 1000);
    /** Next-block mempool/fee — keep SIGNAL fresh */
    const signalId = window.setInterval(() => {
      void bitcoin
        .getStatus()
        .then((s) => {
          tipFails = 0;
          applyChain(s);
        })
        .catch(() => {
          tipFails += 1;
          setStatus({ nodeStatus: "OFFLINE" });
        });
    }, 8_000);
    const memId = window.setInterval(() => {
      void fetch("/api/memory")
        .then((r) => r.json())
        .then((data: { entries?: MemoryEntry[] }) => {
          if (data.entries) setMemory(data.entries);
        })
        .catch(() => undefined);
    }, 30000);

    return () => {
      window.clearInterval(id);
      window.clearInterval(signalId);
      window.clearInterval(memId);
    };
  }, [bitcoin, hydrated, setMemory, setStatus, tickClock]);

  if (!hydrated) {
    return <div className={styles.bootWait}>·</div>;
  }

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        {phase === "boot" ? <BootSequence /> : <InstrumentFrame />}
      </main>
    </div>
  );
}

export function SystemShell() {
  const isClient = useIsClient();
  const blocked = useIsMobileBlocked();

  if (!isClient) {
    return <div className={styles.shell} />;
  }

  if (blocked) {
    return <DesktopOnlyGate />;
  }

  return (
    <BitcoinProviderRoot>
      <WalletProviderRoot>
        <Runtime />
      </WalletProviderRoot>
    </BitcoinProviderRoot>
  );
}
