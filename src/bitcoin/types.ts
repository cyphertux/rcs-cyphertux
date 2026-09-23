import type { MemoryEntry } from "@/domain/memory";

export type CreateTransmissionInput = {
  message: string;
  sats: number;
  channel: string;
  /** Hex PSBT or raw — provider-specific after wallet signs */
};

export type SealLockMeta = {
  lockAddress: string;
  lockVout: number;
  lockValue: number;
  leafScriptHex: string;
  controlBlockHex: string;
  outputScriptHex: string;
  xOnlyPubHex: string;
  redeemVersion: number;
};

export type PreparedTransmission = {
  declaredSats: number;
  anchorSats: number;
  feeSats: number;
  /** Net cost: anchor + miner fee (+ lock for seal) */
  totalSats: number;
  changeSats: number;
  inputSats: number;
  feeRateSatVb: number;
  channel: string;
  message: string;
  truncated: boolean;
  /** Base64 PSBT for wallet signing */
  psbtBase64: string;
  commitHash?: string;
  lockHeight?: number;
  lock?: SealLockMeta;
  /** Inputs that need special Unisat sign flags (tap leaf) */
  signHints?: {
    tapInputIndexes: number[];
    feeInputIndexes?: number[];
    pubkeyHex?: string;
  };
  summary: {
    value: number;
    anchor: number;
    fee: number;
    total: number;
    change: number;
  };
};

export type BroadcastResult = {
  txid: string;
  status: "PENDING";
};

export type ConfirmationResult = {
  txid: string;
  status: "CONFIRMED" | "PENDING" | "FAILED";
  blockHeight?: number;
};

export type SystemChainStatus = {
  networkLabel: string;
  channel: string;
  nodeStatus: "ONLINE" | "DEGRADED" | "OFFLINE";
  blockHeight: number;
  /** Full mempool tx count */
  queueSize: number;
  time: string;
  /** ~3-block relay fee */
  feeRateSatVb: number;
  /** Median fee of projected next block */
  nextFeeSatVb: number;
  nextFeeMin: number;
  nextFeeMax: number;
  nextBlockTx: number;
  nextBlockVsize: number;
  nextTotalFees: number;
  mempoolVsize: number;
  mempoolTotalFee: number;
  /** Next-block template fill vs ~1MvB */
  mempoolFill: number;
  tipAgeSec: number;
};

export interface BitcoinProvider {
  getStatus(): Promise<SystemChainStatus>;
  getBlockHeight(): Promise<number>;
  /** Build unsigned PSBT for wallet */
  prepareTransmission(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    walletUtxos?: Array<{
      txid: string;
      vout: number;
      status: { confirmed: boolean; block_height?: number };
      value: number;
    }>;
  }): Promise<PreparedTransmission>;
  prepareSeal(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    lockHeight: number;
    pubkeyHex: string;
    walletUtxos?: Array<{
      txid: string;
      vout: number;
      status: { confirmed: boolean; block_height?: number };
      value: number;
    }>;
  }): Promise<PreparedTransmission>;
  prepareReveal(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    lockHeight: number;
    /** When set, spend Taproot CLTV lock (hard reveal) */
    lockSpend?: SealLockMeta & { txid: string };
    walletUtxos?: Array<{
      txid: string;
      vout: number;
      status: { confirmed: boolean; block_height?: number };
      value: number;
    }>;
  }): Promise<PreparedTransmission>;
  broadcastSignedPsbt(signedPsbtBase64: string): Promise<BroadcastResult>;
  getTransmissionStatus(txid: string): Promise<ConfirmationResult>;
  listMemory(): Promise<MemoryEntry[]>;
  getMemoryById(id: string): Promise<MemoryEntry | null>;
  getMemoryByTxid(txid: string): Promise<MemoryEntry | null>;
}
