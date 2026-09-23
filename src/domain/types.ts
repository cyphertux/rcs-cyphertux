export type NodeStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export type SystemStatus = {
  channel: string;
  nodeStatus: NodeStatus;
  blockHeight: number;
  queueSize: number;
  time: string;
  networkLabel: string;
  memoryCount: number;
  /** Unique initiator addresses in indexed memory */
  emitterCount: number;
  feeRateSatVb: number;
  nextFeeSatVb: number;
  nextFeeMin: number;
  nextFeeMax: number;
  nextBlockTx: number;
  nextBlockVsize: number;
  nextTotalFees: number;
  mempoolVsize: number;
  mempoolTotalFee: number;
  mempoolFill: number;
  tipAgeSec: number;
  /** ms timestamp of last successful chain probe */
  lastProbeAt: number;
};

export type MachinePhase = "boot" | "ready";

export type VisualMode =
  | "idle"
  | "network"
  | "transmit"
  | "seal"
  | "reveal"
  | "memory"
  | "emitters"
  | "help"
  | "calendar"
  | "status"
  | "about"
  | "debug"
  | "link"
  | "tutorial"
  | "error";

export type CursorMode =
  | "idle"
  | "processing"
  | "transmitting"
  | "receiving"
  | "error";

export type TerminalLine = {
  id: string;
  kind: "input" | "output" | "system" | "error" | "dim" | "bright";
  text: string;
};

export type NetworkReveal = 0 | 1 | 2 | 3;

export type TransmitStep =
  | "value"
  | "message"
  | "confirm"
  | "signing"
  | "signal"
  | "broadcast"
  | "confirmed"
  | "cancelled"
  | "failed";

export type TransmitFlow = {
  kind: "transmit";
  step: TransmitStep;
  sats: number;
  message: string;
  feeSats?: number;
  anchorSats?: number;
  totalSats?: number;
  changeSats?: number;
  inputSats?: number;
  feeRateSatVb?: number;
  truncated?: boolean;
  psbtBase64?: string;
  txid?: string;
  blockHeight?: number;
  memoryId?: string;
  error?: string;
};

export type SealStep =
  | "value"
  | "message"
  | "unlock"
  | "confirm"
  | "signing"
  | "signal"
  | "broadcast"
  | "confirmed"
  | "cancelled"
  | "failed";

export type SealFlow = {
  kind: "seal";
  step: SealStep;
  sats: number;
  message: string;
  /** Blocks after tip, or absolute height when confirm ready */
  unlockDelta?: number;
  lockHeight?: number;
  commitHash?: string;
  lockAddress?: string;
  lockVout?: number;
  lockValue?: number;
  leafScriptHex?: string;
  controlBlockHex?: string;
  outputScriptHex?: string;
  xOnlyPubHex?: string;
  redeemVersion?: number;
  feeSats?: number;
  anchorSats?: number;
  totalSats?: number;
  changeSats?: number;
  inputSats?: number;
  feeRateSatVb?: number;
  psbtBase64?: string;
  txid?: string;
  blockHeight?: number;
  memoryId?: string;
  error?: string;
};

export type RevealStep =
  | "list"
  | "confirm"
  | "signing"
  | "signal"
  | "broadcast"
  | "confirmed"
  | "cancelled"
  | "failed"
  | "locked";

export type RevealFlow = {
  kind: "reveal";
  step: RevealStep;
  /** Local pending seal index (1-based) when selected */
  selectedIndex?: number;
  sealTxid?: string;
  sats?: number;
  message?: string;
  lockHeight?: number;
  commitHash?: string;
  channel?: string;
  tip?: number;
  feeSats?: number;
  anchorSats?: number;
  totalSats?: number;
  changeSats?: number;
  inputSats?: number;
  feeRateSatVb?: number;
  truncated?: boolean;
  psbtBase64?: string;
  signHints?: {
    tapInputIndexes: number[];
    feeInputIndexes?: number[];
    pubkeyHex?: string;
  };
  txid?: string;
  blockHeight?: number;
  memoryId?: string;
  error?: string;
};

export type MemoryFlow = {
  kind: "memory";
  step: "list" | "detail";
  selectedId?: string;
};

export type CalendarFlow = {
  kind: "calendar";
  step: "grid" | "day";
  selectedDate?: string;
};

export type TutorialFlow = {
  kind: "tutorial";
  /** 0 = menu, 1–5 = step detail */
  step: number;
};

export type EmittersFlow = {
  kind: "emitters";
  step: "list" | "detail";
  selectedAddress?: string;
};

export type ActiveFlow =
  | TransmitFlow
  | SealFlow
  | RevealFlow
  | MemoryFlow
  | EmittersFlow
  | CalendarFlow
  | TutorialFlow
  | null;

export const GLYPH = {
  NODE: "◉",
  OFFLINE: "○",
  TRANSMISSION: "◆",
  MEMORY: "◇",
  CHANNEL: "△",
  ERROR: "╳",
  MARK: "▣",
  DOT: "·",
  SEP: "┊",
} as const;
