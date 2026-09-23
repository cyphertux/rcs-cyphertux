import type { MemoryEntry } from "@/domain/memory";
import type {
  BitcoinProvider,
  BroadcastResult,
  ConfirmationResult,
  PreparedTransmission,
  SystemChainStatus,
} from "./types";

/**
 * Browser-side provider: talks to Next.js API routes.
 * Never touches keys; PSBT build/broadcast run on server / Esplora.
 */
export class ClientBitcoinProvider implements BitcoinProvider {
  async getStatus(): Promise<SystemChainStatus> {
    const res = await fetch("/api/chain/status");
    if (!res.ok) throw new Error("CHAIN STATUS FAILED");
    return res.json() as Promise<SystemChainStatus>;
  }

  async getBlockHeight(): Promise<number> {
    const s = await this.getStatus();
    return s.blockHeight;
  }

  async prepareTransmission(input: {
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
  }): Promise<PreparedTransmission> {
    const res = await fetch("/api/transmit/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "PREPARE FAILED");
    return data as PreparedTransmission;
  }

  async prepareSeal(input: {
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
  }): Promise<PreparedTransmission> {
    const res = await fetch("/api/transmit/prepare-seal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "SEAL PREPARE FAILED");
    return data as PreparedTransmission;
  }

  async prepareReveal(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    lockHeight: number;
    lockSpend?: import("./types").SealLockMeta & { txid: string };
    walletUtxos?: Array<{
      txid: string;
      vout: number;
      status: { confirmed: boolean; block_height?: number };
      value: number;
    }>;
  }): Promise<PreparedTransmission> {
    const res = await fetch("/api/transmit/prepare-reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "REVEAL PREPARE FAILED");
    return data as PreparedTransmission;
  }

  async broadcastSignedPsbt(signedPsbtBase64: string): Promise<BroadcastResult> {
    const res = await fetch("/api/transmit/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signed: signedPsbtBase64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "BROADCAST FAILED");
    return data as BroadcastResult;
  }

  async getTransmissionStatus(txid: string): Promise<ConfirmationResult> {
    const res = await fetch(`/api/transmit/status?txid=${encodeURIComponent(txid)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "STATUS FAILED");
    return data as ConfirmationResult;
  }

  async listMemory(): Promise<MemoryEntry[]> {
    const res = await fetch("/api/memory");
    const data = (await res.json()) as { entries?: MemoryEntry[] };
    return data.entries ?? [];
  }

  /** Force Esplora re-index (after broadcast / manual refresh). */
  async refreshMemory(): Promise<MemoryEntry[]> {
    const res = await fetch("/api/memory?refresh=1");
    const data = (await res.json()) as { entries?: MemoryEntry[] };
    return data.entries ?? [];
  }

  async getMemoryById(id: string): Promise<MemoryEntry | null> {
    const res = await fetch(`/api/memory?id=${encodeURIComponent(id)}`);
    const data = (await res.json()) as { entry?: MemoryEntry | null };
    return data.entry ?? null;
  }

  async getMemoryByTxid(txid: string): Promise<MemoryEntry | null> {
    const res = await fetch(`/api/memory?txid=${encodeURIComponent(txid)}`);
    const data = (await res.json()) as { entry?: MemoryEntry | null };
    return data.entry ?? null;
  }
}

export function createClientBitcoinProvider(): ClientBitcoinProvider {
  return new ClientBitcoinProvider();
}
