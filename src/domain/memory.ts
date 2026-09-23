export type MemoryStatus = "PENDING" | "CONFIRMED" | "FAILED";

export type MemoryKind = "open" | "sealed" | "revealed";

export type MemoryEntry = {
  id: string;
  createdAt: string;
  channel: string;
  /** Declared ritual value (from OP_RETURN when present) */
  sats: number;
  /** On-chain sink output (max(declared, dust)) */
  anchorSats: number;
  /** Plaintext when open/revealed; placeholder when sealed */
  message: string;
  txid: string;
  blockHeight: number | null;
  status: MemoryStatus;
  protocolVersion: "RCS/01" | "RCS/02";
  kind: MemoryKind;
  /** First spending input address (initiator) when known */
  fromAddress?: string;
  commitHash?: string;
  unlockHeight?: number;
  /** Set when a reveal opens this seal */
  revealTxid?: string;
  /** Seal txid this reveal opens */
  sealTxid?: string;
};

export type EmitterSummary = {
  address: string;
  count: number;
  lastAt: string;
};

export function formatMemoryId(n: number): string {
  return String(n).padStart(6, "0");
}

/** Unique initiators ranked by message count */
export function aggregateEmitters(entries: MemoryEntry[]): EmitterSummary[] {
  const map = new Map<string, EmitterSummary>();
  for (const e of entries) {
    const addr = e.fromAddress?.trim();
    if (!addr) continue;
    const cur = map.get(addr);
    if (!cur) {
      map.set(addr, { address: addr, count: 1, lastAt: e.createdAt });
    } else {
      cur.count += 1;
      if (e.createdAt > cur.lastAt) cur.lastAt = e.createdAt;
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastAt.localeCompare(a.lastAt);
  });
}
