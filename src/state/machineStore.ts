"use client";

import { create } from "zustand";
import type {
  ActiveFlow,
  CursorMode,
  MachinePhase,
  NetworkReveal,
  SystemStatus,
  TerminalLine,
  VisualMode,
} from "@/domain/types";
import type { MemoryEntry } from "@/domain/memory";
import { aggregateEmitters } from "@/domain/memory";
import { formatTime } from "@/domain/format";
import { getBootSeen, getMute, setBootSeen, setMute } from "@/storage/local";
import { setAudioMuted } from "@/audio/audioSystem";
import { clampMenuIndex } from "@/domain/menu";

type MachineState = {
  hydrated: boolean;
  phase: MachinePhase;
  visualMode: VisualMode;
  cursorMode: CursorMode;
  lines: TerminalLine[];
  memory: MemoryEntry[];
  status: SystemStatus;
  networkReveal: NetworkReveal;
  flow: ActiveFlow;
  muted: boolean;
  reducedMotion: boolean;
  inputLocked: boolean;
  promptLabel: string;
  signalActivity: number;
  menuIndex: number;

  hydrate: () => void;
  finishBoot: () => void;
  appendLine: (line: Omit<TerminalLine, "id">) => void;
  clearLines: () => void;
  setMemory: (entries: MemoryEntry[]) => void;
  tickClock: (blockHeight?: number) => void;
  setStatus: (partial: Partial<SystemStatus>) => void;
  setNetworkReveal: (level: NetworkReveal) => void;
  bumpNetworkReveal: () => NetworkReveal;
  setFlow: (flow: ActiveFlow) => void;
  setVisualMode: (mode: VisualMode) => void;
  setCursorMode: (mode: CursorMode) => void;
  setMuted: (muted: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  setInputLocked: (value: boolean) => void;
  setPromptLabel: (label: string) => void;
  setSignalActivity: (n: number) => void;
  setMenuIndex: (n: number) => void;
  bumpMenuIndex: (delta: number) => void;
  goIdle: () => void;
};

let lineCounter = 0;

function nextLineId(): string {
  lineCounter += 1;
  return `L${lineCounter}`;
}

const initialStatus: SystemStatus = {
  channel: "07",
  nodeStatus: "ONLINE",
  blockHeight: 0,
  queueSize: 0,
  time: "00:00:00",
  networkLabel: "BITCOIN TESTNET4",
  memoryCount: 0,
  emitterCount: 0,
  feeRateSatVb: 0,
  nextFeeSatVb: 0,
  nextFeeMin: 0,
  nextFeeMax: 0,
  nextBlockTx: 0,
  nextBlockVsize: 0,
  nextTotalFees: 0,
  mempoolVsize: 0,
  mempoolTotalFee: 0,
  mempoolFill: 0,
  tipAgeSec: 0,
  lastProbeAt: 0,
};

export const useMachineStore = create<MachineState>((set, get) => ({
  hydrated: false,
  phase: "boot",
  visualMode: "idle",
  cursorMode: "idle",
  lines: [],
  memory: [],
  status: initialStatus,
  networkReveal: 0,
  flow: null,
  muted: true,
  reducedMotion: false,
  inputLocked: false,
  promptLabel: ">",
  signalActivity: 0.2,
  menuIndex: 0,

  hydrate: () => {
    if (get().hydrated) return;
    const bootSeen = getBootSeen();
    const muted = getMute();
    setAudioMuted(muted);
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    set({
      hydrated: true,
      phase: bootSeen ? "ready" : "boot",
      visualMode: "idle",
      cursorMode: "idle",
      muted,
      reducedMotion,
      flow: null,
      promptLabel: ">",
      networkReveal: 0,
      signalActivity: 0.2,
      menuIndex: 0,
      status: { ...initialStatus, time: formatTime() },
      lines: [],
      memory: [],
    });
  },

  finishBoot: () => {
    setBootSeen();
    set({
      phase: "ready",
      visualMode: "idle",
      cursorMode: "idle",
      flow: null,
      promptLabel: ">",
      lines: [],
      signalActivity: 0.25,
      menuIndex: 0,
    });
  },

  appendLine: (line) =>
    set((s) => ({
      lines: [...s.lines, { ...line, id: nextLineId() }].slice(-40),
    })),

  clearLines: () => set({ lines: [] }),

  setMemory: (entries) =>
    set((s) => ({
      memory: entries,
      status: {
        ...s.status,
        memoryCount: entries.length,
        emitterCount: aggregateEmitters(entries).length,
      },
    })),

  tickClock: (blockHeight) =>
    set((s) => ({
      status: {
        ...s.status,
        time: formatTime(),
        blockHeight: blockHeight ?? s.status.blockHeight,
      },
      signalActivity:
        s.status.nodeStatus === "OFFLINE"
          ? 0
          : s.visualMode === "transmit" ||
              s.visualMode === "seal" ||
              s.visualMode === "reveal"
            ? 0.7 + Math.min(0.25, s.status.mempoolFill * 0.2)
            : 0.1 +
              Math.min(0.55, (s.status.nextFeeSatVb || s.status.feeRateSatVb || 1) / 35) +
              Math.min(0.35, s.status.mempoolFill * 0.35),
    })),

  setStatus: (partial) =>
    set((s) => ({ status: { ...s.status, ...partial } })),

  setNetworkReveal: (level) => set({ networkReveal: level }),

  bumpNetworkReveal: () => {
    const current = get().networkReveal;
    const next = Math.min(3, current + 1) as NetworkReveal;
    set({ networkReveal: next });
    return next;
  },

  setFlow: (flow) => set({ flow }),
  setVisualMode: (mode) => set({ visualMode: mode }),
  setCursorMode: (mode) => set({ cursorMode: mode }),

  setMuted: (muted) => {
    setMute(muted);
    setAudioMuted(muted);
    set({ muted });
  },

  setReducedMotion: (value) => set({ reducedMotion: value }),
  setInputLocked: (value) => set({ inputLocked: value }),
  setPromptLabel: (label) => set({ promptLabel: label }),
  setSignalActivity: (n) => set({ signalActivity: n }),

  setMenuIndex: (n) => set({ menuIndex: clampMenuIndex(n) }),
  bumpMenuIndex: (delta) =>
    set((s) => ({ menuIndex: clampMenuIndex(s.menuIndex + delta) })),

  goIdle: () =>
    set({
      visualMode: "idle",
      cursorMode: "idle",
      flow: null,
      promptLabel: ">",
      inputLocked: false,
      signalActivity: 0.2,
    }),
}));
