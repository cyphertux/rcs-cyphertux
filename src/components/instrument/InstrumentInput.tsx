"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { playCue } from "@/audio/audioSystem";
import { useBitcoin } from "@/bitcoin/BitcoinContext";
import type { MemoryEntry } from "@/domain/memory";
import {
  ensureCommandsRegistered,
  handleSystemInput,
} from "@/domain/commands/handlers";
import type { FlowIO } from "@/domain/flows";
import { goBack } from "@/domain/flows";
import { getSommaire } from "@/domain/menu";
import { registerMenuRunner } from "@/domain/menuRunner";
import { useMachineStore } from "@/state/machineStore";
import { useWallet } from "@/wallet/WalletContext";
import { InstrumentCursor } from "./InstrumentCursor";
import styles from "./InstrumentInput.module.css";

ensureCommandsRegistered();

async function fetchMemory(force = false): Promise<MemoryEntry[]> {
  const res = await fetch(force ? "/api/memory?refresh=1" : "/api/memory");
  const data = (await res.json()) as { entries?: MemoryEntry[] };
  return data.entries ?? [];
}

function isSommaireMode(): boolean {
  const s = useMachineStore.getState();
  return (
    !s.flow &&
    (s.visualMode === "idle" || s.visualMode === "error") &&
    s.status.nodeStatus !== "OFFLINE"
  );
}

export function InstrumentInput() {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bitcoin = useBitcoin();
  const wallet = useWallet();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  /** Sync wallet snapshot — updated immediately on connect/refresh. */
  const liveWallet = useRef({
    address: null as string | null,
    balanceSats: 0,
    connected: false,
  });

  useEffect(() => {
    liveWallet.current = {
      address: wallet.address,
      balanceSats: wallet.balanceSats,
      connected: wallet.connected,
    };
  }, [wallet.address, wallet.balanceSats, wallet.connected]);

  const inputLocked = useMachineStore((s) => s.inputLocked);
  const promptLabel = useMachineStore((s) => s.promptLabel);
  const cursorMode = useMachineStore((s) => s.cursorMode);
  const reducedMotion = useMachineStore((s) => s.reducedMotion);
  const lines = useMachineStore((s) => s.lines);
  const visualMode = useMachineStore((s) => s.visualMode);

  const appendLine = useMachineStore((s) => s.appendLine);
  const clearLines = useMachineStore((s) => s.clearLines);
  const setMuted = useMachineStore((s) => s.setMuted);
  const setFlow = useMachineStore((s) => s.setFlow);
  const setPromptLabel = useMachineStore((s) => s.setPromptLabel);
  const setInputLocked = useMachineStore((s) => s.setInputLocked);
  const setMemory = useMachineStore((s) => s.setMemory);
  const setStatus = useMachineStore((s) => s.setStatus);
  const bumpNetworkReveal = useMachineStore((s) => s.bumpNetworkReveal);
  const setVisualMode = useMachineStore((s) => s.setVisualMode);
  const setCursorMode = useMachineStore((s) => s.setCursorMode);
  const goIdle = useMachineStore((s) => s.goIdle);
  const bumpMenuIndex = useMachineStore((s) => s.bumpMenuIndex);
  const getFlow = useCallback(() => useMachineStore.getState().flow, []);

  useEffect(() => {
    if (!inputLocked) inputRef.current?.focus();
  }, [inputLocked, promptLabel, cursorMode, visualMode]);

  const refreshMemory = useCallback(async () => {
    const entries = await fetchMemory(true);
    setMemory(entries);
    return entries;
  }, [setMemory]);

  const refreshStatus = useCallback(async () => {
    const s = await bitcoin.getStatus();
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
  }, [bitcoin, setStatus]);

  const flowIO: FlowIO = useMemo(
    () => ({
      append: (kind, text) => appendLine({ kind, text }),
      clear: clearLines,
      getFlow,
      setFlow,
      setPrompt: setPromptLabel,
      setLocked: setInputLocked,
      getMemory: () => useMachineStore.getState().memory,
      setMemory,
      getChannel: () => useMachineStore.getState().status.channel,
      getBlock: () => useMachineStore.getState().status.blockHeight,
      setBlock: (n) => setStatus({ blockHeight: n }),
      bitcoin,
      reducedMotion,
      setVisualMode,
      setCursorMode,
      goIdle,
      getVisualMode: () => useMachineStore.getState().visualMode,
      getNodeStatus: () => useMachineStore.getState().status.nodeStatus,
      getWalletBalance: () => liveWallet.current.balanceSats,
      isWalletConnected: () => liveWallet.current.connected,
      getWalletAddress: () => liveWallet.current.address,
      refreshWalletBalance: async () => {
        const bal = await walletRef.current.refresh();
        liveWallet.current = {
          ...liveWallet.current,
          balanceSats: bal,
          connected: liveWallet.current.connected || bal > 0,
        };
        return bal;
      },
      signPsbt: (psbt, options) => walletRef.current.signPsbt(psbt, options),
      getPublicKey: () => walletRef.current.getPublicKey(),
      pushPsbt: (hex) => walletRef.current.pushPsbt(hex),
      getWalletUtxos: async () => {
        const w = walletRef.current.adapter;
        if (!w?.getUtxos) return [];
        return w.getUtxos();
      },
      refreshMemory,
      refreshStatus,
      connectWallet: async () => {
        const r = await walletRef.current.connect();
        liveWallet.current = {
          address: r.address,
          balanceSats: r.balanceSats,
          connected: true,
        };
      },
    }),
    [
      appendLine,
      bitcoin,
      clearLines,
      getFlow,
      goIdle,
      reducedMotion,
      refreshMemory,
      refreshStatus,
      setCursorMode,
      setFlow,
      setInputLocked,
      setMemory,
      setPromptLabel,
      setStatus,
      setVisualMode,
    ],
  );

  const runCommand = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || useMachineStore.getState().inputLocked) return;
      playCue("key");
      setHistory((h) => [trimmed, ...h].slice(0, 60));
      setHistIdx(-1);
      setValue("");

      await handleSystemInput(trimmed, {
        appendLine: (kind, text) => appendLine({ kind, text }),
        clearLines,
        toggleMute: () => {
          const next = !useMachineStore.getState().muted;
          setMuted(next);
          return next;
        },
        getStatus: () => useMachineStore.getState().status,
        getNetworkReveal: () => useMachineStore.getState().networkReveal,
        bumpNetworkReveal,
        flowIO,
        connectWallet: async () => {
          const r = await walletRef.current.connect();
          liveWallet.current = {
            address: r.address,
            balanceSats: r.balanceSats,
            connected: true,
          };
        },
        disconnectWallet: () => {
          walletRef.current.disconnect();
          liveWallet.current = {
            address: null,
            balanceSats: 0,
            connected: false,
          };
        },
        walletConnected: () => liveWallet.current.connected,
        walletAddress: () => liveWallet.current.address,
        walletBalance: () => liveWallet.current.balanceSats,
      });
    },
    [appendLine, bumpNetworkReveal, clearLines, flowIO, setMuted],
  );

  useEffect(() => {
    registerMenuRunner((cmd) => runCommand(cmd));
    return () => registerMenuRunner(null);
  }, [runCommand]);

  const submit = async (raw: string) => {
    const trimmed = raw.trim();
    if (inputLocked) return;
    if (!trimmed && isSommaireMode()) {
      const idx = useMachineStore.getState().menuIndex;
      const code = getSommaire()[idx]?.code;
      if (code) await runCommand(code);
      return;
    }
    if (!trimmed) return;
    await runCommand(trimmed);
  };

  const retour = useCallback(() => {
    goBack(flowIO);
    setValue("");
    setHistIdx(-1);
    inputRef.current?.focus();
  }, [flowIO]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      retour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [retour]);

  const flow = useMachineStore((s) => s.flow);
  const digitsOnly =
    (flow?.kind === "seal" && flow.step === "unlock") ||
    (flow?.kind === "seal" && flow.step === "value") ||
    (flow?.kind === "transmit" && flow.step === "value") ||
    (flow?.kind === "reveal" && flow.step === "list");

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Escape is handled once by the window listener (avoids detail→list→idle double-fire)

    if (digitsOnly) {
      const allow =
        e.key === "Enter" ||
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /^[0-9]$/.test(e.key);
      if (!allow) {
        e.preventDefault();
        return;
      }
    }

    const sommaire = isSommaireMode() && value.trim() === "";

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (sommaire) {
        bumpMenuIndex(-1);
        playCue("key");
        return;
      }
      if (digitsOnly) return;
      const next = Math.min(histIdx + 1, history.length - 1);
      if (next >= 0 && history[next]) {
        setHistIdx(next);
        setValue(history[next]!);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (sommaire) {
        bumpMenuIndex(1);
        playCue("key");
        return;
      }
      if (digitsOnly) return;
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setValue("");
      } else if (history[next]) {
        setHistIdx(next);
        setValue(history[next]!);
      }
    }
  };

  return (
    <div className={styles.wrap}>
      {lines.length > 0 ? (
        <div className={styles.eventStrip} aria-live="polite">
          {lines.slice(-2).map((l) => (
            <div
              key={l.id}
              className={[
                styles.event,
                l.kind === "error" ? styles.eventError : "",
                l.kind === "bright" ? styles.eventBright : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {l.text}
            </div>
          ))}
        </div>
      ) : null}

      <form
        className={styles.prompt}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(value);
        }}
      >
        <span className={styles.gt} data-prompt-gt>
          {promptLabel}
        </span>
        <input
          ref={inputRef}
          className={styles.field}
          data-instrument-field
          value={value}
          inputMode={digitsOnly ? "numeric" : "text"}
          pattern={digitsOnly ? "[0-9]*" : undefined}
          onChange={(e) => {
            const next = e.target.value;
            setValue(digitsOnly ? next.replace(/[^0-9]/g, "") : next);
          }}
          onKeyDown={onKeyDown}
          disabled={inputLocked}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Command input"
        />
        <InstrumentCursor mode={cursorMode} />
      </form>
    </div>
  );
}
