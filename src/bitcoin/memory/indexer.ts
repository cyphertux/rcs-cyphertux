import { BITCOIN_CONFIG } from "@/bitcoin/config";
import { EsploraClient, type EsploraTx } from "@/bitcoin/esplora";
import { decodeRcs01Payload } from "@/bitcoin/protocol/rcs01";
import {
  commitHashHex,
  decodeRcs02Payload,
} from "@/bitcoin/protocol/rcs02";
import { formatMemoryId, type MemoryEntry } from "@/domain/memory";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Extract OP_RETURN data pushes from script hex */
export function extractOpReturnData(scriptHex: string): Uint8Array | null {
  const bytes = hexToBytes(scriptHex);
  if (bytes.length < 2 || bytes[0] !== 0x6a) return null;
  let i = 1;
  const chunks: number[] = [];
  while (i < bytes.length) {
    const op = bytes[i]!;
    i += 1;
    if (op >= 1 && op <= 75) {
      const len = op;
      for (let j = 0; j < len && i < bytes.length; j++, i++) {
        chunks.push(bytes[i]!);
      }
    } else if (op === 0x4c && i < bytes.length) {
      const len = bytes[i]!;
      i += 1;
      for (let j = 0; j < len && i < bytes.length; j++, i++) {
        chunks.push(bytes[i]!);
      }
    } else {
      break;
    }
  }
  return chunks.length ? Uint8Array.from(chunks) : null;
}

type RawEntry = Omit<MemoryEntry, "id">;

function sinkMeta(tx: EsploraTx): {
  anchor: number;
  confirmed: boolean;
  blockHeight: number | null;
  createdAt: string;
} {
  const sinkOut = tx.vout.find(
    (v) => v.scriptpubkey_address === BITCOIN_CONFIG.protocolSink,
  );
  const anchor = sinkOut?.value ?? BITCOIN_CONFIG.dustSats;
  const confirmed = tx.status.confirmed;
  const blockHeight = tx.status.block_height ?? null;
  const createdAt = tx.status.block_time
    ? new Date(tx.status.block_time * 1000).toISOString()
    : new Date().toISOString();
  return { anchor, confirmed, blockHeight, createdAt };
}

function isTaprootAddress(addr: string): boolean {
  return addr.startsWith("tb1p") || addr.startsWith("bc1p");
}

/**
 * Initiator wallet — skip protocol sink and Taproot lock UTXOs (546 ritual).
 * Reveal spends the P2TR lock first; the fee-paying P2WPKH is the real emitter.
 */
function senderAddress(tx: EsploraTx): string | undefined {
  const sink = BITCOIN_CONFIG.protocolSink;
  const addrs: string[] = [];
  for (const vin of tx.vin ?? []) {
    const addr = vin.prevout?.scriptpubkey_address;
    if (addr && addr !== sink) addrs.push(addr);
  }
  if (addrs.length === 0) return undefined;
  return (
    addrs.find((a) => !isTaprootAddress(a)) ??
    // no wallet input (shouldn't happen on our reveals) — omit rather than fake emitter
    undefined
  );
}

function parseTx(tx: EsploraTx): RawEntry | null {
  const fromAddress = senderAddress(tx);
  for (const out of tx.vout) {
    if (
      out.scriptpubkey_type !== "op_return" &&
      !out.scriptpubkey?.startsWith("6a")
    ) {
      continue;
    }
    const data = extractOpReturnData(out.scriptpubkey);
    if (!data) continue;

    const rcs02 = decodeRcs02Payload(data);
    if (rcs02) {
      const meta = sinkMeta(tx);
      if (rcs02.kind === "seal") {
        return {
          createdAt: meta.createdAt,
          channel: rcs02.channel,
          sats: rcs02.declaredSats,
          anchorSats: meta.anchor,
          message: "████",
          txid: tx.txid,
          blockHeight: meta.blockHeight,
          status: meta.confirmed ? "CONFIRMED" : "PENDING",
          protocolVersion: "RCS/02",
          kind: "sealed",
          fromAddress,
          commitHash: rcs02.commitHash,
          unlockHeight: rcs02.lockHeight,
        };
      }
      return {
        createdAt: meta.createdAt,
        channel: rcs02.channel,
        sats: rcs02.declaredSats,
        anchorSats: meta.anchor,
        message: rcs02.message,
        txid: tx.txid,
        blockHeight: meta.blockHeight,
        status: meta.confirmed ? "CONFIRMED" : "PENDING",
        protocolVersion: "RCS/02",
        kind: "revealed",
        fromAddress,
      };
    }

    const rcs01 = decodeRcs01Payload(data);
    if (!rcs01) continue;
    const meta = sinkMeta(tx);
    const sats = rcs01.declaredSats ?? meta.anchor;
    return {
      createdAt: meta.createdAt,
      channel: rcs01.channel,
      sats,
      anchorSats: meta.anchor,
      message: rcs01.message,
      txid: tx.txid,
      blockHeight: meta.blockHeight,
      status: meta.confirmed ? "CONFIRMED" : "PENDING",
      protocolVersion: "RCS/01",
      kind: "open",
      fromAddress,
    };
  }
  return null;
}

async function linkReveals(entries: RawEntry[]): Promise<RawEntry[]> {
  const seals = entries.filter((e) => e.kind === "sealed" && e.commitHash);
  const reveals = entries.filter((e) => e.kind === "revealed");
  const dropRevealTxids = new Set<string>();

  for (const reveal of reveals) {
    const h = await commitHashHex(reveal.message);
    const seal = seals.find(
      (s) =>
        s.commitHash === h &&
        s.channel === reveal.channel &&
        !s.revealTxid,
    );
    if (seal) {
      // Merge into the seal row — one logical message in MEMORY
      seal.kind = "revealed";
      seal.message = reveal.message;
      seal.revealTxid = reveal.txid;
      seal.status = reveal.status;
      if (reveal.blockHeight != null) seal.blockHeight = reveal.blockHeight;
      if (reveal.createdAt) seal.createdAt = reveal.createdAt;
      // Never inherit Taproot lock addr from reveal — keep seal wallet
      if (
        !seal.fromAddress &&
        reveal.fromAddress &&
        !isTaprootAddress(reveal.fromAddress)
      ) {
        seal.fromAddress = reveal.fromAddress;
      }
      dropRevealTxids.add(reveal.txid);
    }
  }

  // Drop standalone reveal txs that were folded into their seal
  return entries.filter((e) => !dropRevealTxids.has(e.txid));
}

let cache: { at: number; entries: MemoryEntry[] } | null = null;
const CACHE_MS = 15_000;

export async function indexMemory(
  esplora = new EsploraClient(),
): Promise<MemoryEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.entries;
  }

  const txs = await esplora.getAddressTxs(BITCOIN_CONFIG.protocolSink);
  const parsed: RawEntry[] = [];

  for (const tx of txs) {
    const entry = parseTx(tx);
    if (entry) parsed.push(entry);
  }

  await linkReveals(parsed);

  parsed.sort((a, b) => {
    const ah = a.blockHeight ?? Number.MAX_SAFE_INTEGER;
    const bh = b.blockHeight ?? Number.MAX_SAFE_INTEGER;
    if (ah !== bh) return ah - bh;
    return a.txid.localeCompare(b.txid);
  });

  const entries: MemoryEntry[] = parsed.map((e, i) => ({
    ...e,
    id: formatMemoryId(i + 1),
  }));

  cache = { at: Date.now(), entries };
  return entries;
}

export function invalidateMemoryCache(): void {
  cache = null;
}
