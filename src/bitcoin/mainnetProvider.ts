import type { MemoryEntry } from "@/domain/memory";
import type {
  BitcoinProvider,
  BroadcastResult,
  ConfirmationResult,
  PreparedTransmission,
  SystemChainStatus,
} from "./types";

/** Mainnet stub — refuses until explicitly enabled */
export class BitcoinMainnetProvider implements BitcoinProvider {
  private refuse(): never {
    throw new Error("MAINNET DISABLED — SET NETWORK=testnet");
  }

  async getStatus(): Promise<SystemChainStatus> {
    this.refuse();
  }
  async getBlockHeight(): Promise<number> {
    this.refuse();
  }
  async prepareTransmission(): Promise<PreparedTransmission> {
    this.refuse();
  }
  async prepareSeal(): Promise<PreparedTransmission> {
    this.refuse();
  }
  async prepareReveal(): Promise<PreparedTransmission> {
    this.refuse();
  }
  async broadcastSignedPsbt(): Promise<BroadcastResult> {
    this.refuse();
  }
  async getTransmissionStatus(): Promise<ConfirmationResult> {
    this.refuse();
  }
  async listMemory(): Promise<MemoryEntry[]> {
    this.refuse();
  }
  async getMemoryById(): Promise<MemoryEntry | null> {
    this.refuse();
  }
  async getMemoryByTxid(): Promise<MemoryEntry | null> {
    this.refuse();
  }
}
