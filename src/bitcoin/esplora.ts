import {
  BITCOIN_CONFIG,
  FALLBACK_FEE_SAT_VB,
  esploraBases,
} from "./config";

export type EsploraUtxo = {
  txid: string;
  vout: number;
  status: { confirmed: boolean; block_height?: number };
  value: number;
};

export type EsploraTx = {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_type?: string;
    scriptpubkey_address?: string;
    value: number;
  }>;
  vin?: Array<{
    txid?: string;
    vout?: number;
    prevout?: {
      scriptpubkey?: string;
      scriptpubkey_address?: string;
      value?: number;
    };
  }>;
  fee?: number;
};

export type MempoolBlockProjection = {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  totalFees: number;
  medianFee: number;
  feeRange: number[];
};

export type NextBlockSignal = {
  tipHeight: number;
  tipAgeSec: number;
  nextFeeSatVb: number;
  nextFeeMin: number;
  nextFeeMax: number;
  nextMedianFee: number;
  nextBlockTx: number;
  nextBlockVsize: number;
  nextTotalFees: number;
  mempoolTx: number;
  mempoolVsize: number;
  mempoolTotalFee: number;
  fillRatio: number;
  relayFeeSatVb: number;
  projectionOk: boolean;
};

export class EsploraClient {
  private base: string;

  constructor(base = BITCOIN_CONFIG.esploraBase) {
    this.base = base;
  }

  /** Switch active base (after successful fallback probe) */
  useBase(url: string): void {
    this.base = url;
  }

  getBase(): string {
    return this.base;
  }

  /** Prefer last-good base, then the rest of the pool */
  private orderedBases(): string[] {
    const all = esploraBases();
    if (!this.base || !all.includes(this.base)) return all;
    return [this.base, ...all.filter((b) => b !== this.base)];
  }

  private async getFrom<T>(
    base: string,
    path: string,
    timeoutMs = 12_000,
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, {
        next: { revalidate: 0 },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`ESPLORA ${path} → ${res.status}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  private async tryBases<T>(
    run: (base: string) => Promise<T>,
    label: string,
  ): Promise<T> {
    let lastErr: unknown;
    for (const base of this.orderedBases()) {
      try {
        const result = await run(base);
        if (base !== this.base) this.useBase(base);
        return result;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`ESPLORA ${label} UNREACHABLE`);
  }

  private async get<T>(path: string, timeoutMs = 12_000): Promise<T> {
    return this.tryBases(
      (base) => this.getFrom<T>(base, path, timeoutMs),
      path,
    );
  }

  async getTipHeight(): Promise<number> {
    return this.tryBases(async (base) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      try {
        const res = await fetch(`${base}/blocks/tip/height`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`ESPLORA tip/height → ${res.status}`);
        const text = await res.text();
        const n = Number(text);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error("ESPLORA tip/height INVALID");
        }
        return n;
      } finally {
        clearTimeout(timer);
      }
    }, "TIP");
  }

  async getAddressUtxos(address: string): Promise<EsploraUtxo[]> {
    const a = encodeURIComponent(address);
    return this.get<EsploraUtxo[]>(`/address/${a}/utxo`);
  }

  async getAddressStats(address: string): Promise<{
    chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
    mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
  }> {
    const a = encodeURIComponent(address);
    return this.get(`/address/${a}`);
  }

  async getBalance(address: string): Promise<number> {
    const stats = await this.getAddressStats(address);
    const chain =
      stats.chain_stats.funded_txo_sum - stats.chain_stats.spent_txo_sum;
    const mem =
      stats.mempool_stats.funded_txo_sum - stats.mempool_stats.spent_txo_sum;
    return chain + mem;
  }

  async getTx(txid: string): Promise<EsploraTx> {
    const id = encodeURIComponent(txid);
    return this.get<EsploraTx>(`/tx/${id}`);
  }

  async getAddressTxs(address: string): Promise<EsploraTx[]> {
    const a = encodeURIComponent(address);
    return this.get<EsploraTx[]>(`/address/${a}/txs`);
  }

  async getFeeEstimates(): Promise<Record<string, number>> {
    return this.get<Record<string, number>>("/fee-estimates");
  }

  async getMempool(): Promise<{
    count: number;
    vsize: number;
    total_fee: number;
  }> {
    return this.get("/mempool");
  }

  /** Projected mempool blocks — index 0 = next block template */
  async getMempoolBlocks(): Promise<MempoolBlockProjection[]> {
    return this.get("/v1/fees/mempool-blocks");
  }

  async getRecommendedFees(): Promise<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  } | null> {
    try {
      return await this.get("/v1/fees/recommended");
    } catch {
      return null;
    }
  }

  async getTipBlock(): Promise<{
    id: string;
    height: number;
    timestamp: number;
  } | null> {
    try {
      return await this.tryBases(async (base) => {
        const hashRes = await fetch(`${base}/blocks/tip/hash`);
        if (!hashRes.ok) throw new Error(`tip/hash → ${hashRes.status}`);
        const hash = (await hashRes.text()).trim();
        if (!hash) throw new Error("tip/hash empty");
        return this.getFrom<{
          id: string;
          height: number;
          timestamp: number;
        }>(base, `/block/${hash}`);
      }, "TIP_BLOCK");
    } catch {
      return null;
    }
  }

  /**
   * Live next-block formation. Throws if chain tip is unreachable (network down).
   */
  async getNextBlockSignal(): Promise<NextBlockSignal> {
    const BLOCK_VSIZE = 1_000_000;

    const tipHeight = await this.getTipHeight();

    const [estimates, mempool, tip, projected, recommended] =
      await Promise.all([
        this.getFeeEstimates().catch(() => ({} as Record<string, number>)),
        this.getMempool().catch(() => ({
          count: 0,
          vsize: 0,
          total_fee: 0,
        })),
        this.getTipBlock(),
        this.getMempoolBlocks()
          .then((blocks) => ({ ok: true as const, blocks }))
          .catch(() => ({
            ok: false as const,
            blocks: [] as MempoolBlockProjection[],
          })),
        this.getRecommendedFees(),
      ]);

    const projectionOk = projected.ok && projected.blocks.length > 0;
    const next = projected.blocks[0];
    const sortedRange = [...(next?.feeRange ?? [])].sort((a, b) => a - b);

    const nextMedian = next
      ? Math.max(1, Math.ceil(next.medianFee))
      : Math.max(
          1,
          Math.ceil(
            recommended?.fastestFee ??
              estimates["1"] ??
              estimates["2"] ??
              FALLBACK_FEE_SAT_VB,
          ),
        );

    const nextFeeMin = sortedRange.length
      ? Math.max(1, Math.ceil(sortedRange[0]!))
      : Math.max(1, Math.ceil(recommended?.minimumFee ?? nextMedian));
    const nextFeeMax = sortedRange.length
      ? Math.max(nextFeeMin, Math.ceil(sortedRange[sortedRange.length - 1]!))
      : nextMedian;

    const nextBlockVsize =
      next?.blockVSize ?? Math.min(mempool.vsize, BLOCK_VSIZE);
    const fillRatio = Math.min(2, nextBlockVsize / BLOCK_VSIZE);

    const relayFeeSatVb = Math.max(
      1,
      Math.ceil(
        estimates["3"] ??
          estimates["2"] ??
          recommended?.halfHourFee ??
          nextMedian,
      ),
    );

    const tipAgeSec = tip
      ? Math.max(0, Math.floor(Date.now() / 1000 - tip.timestamp))
      : 0;

    return {
      tipHeight: tip?.height ?? tipHeight,
      tipAgeSec,
      nextFeeSatVb: nextMedian,
      nextFeeMin,
      nextFeeMax,
      nextMedianFee: nextMedian,
      nextBlockTx: next?.nTx ?? 0,
      nextBlockVsize,
      nextTotalFees: Math.round(next?.totalFees ?? 0),
      mempoolTx: mempool.count,
      mempoolVsize: mempool.vsize,
      mempoolTotalFee: Math.round(mempool.total_fee),
      fillRatio,
      relayFeeSatVb,
      projectionOk,
    };
  }

  async recommendFeeRate(): Promise<number> {
    try {
      const recommended = await this.getRecommendedFees();
      const fromRec =
        recommended?.halfHourFee ??
        recommended?.hourFee ??
        recommended?.fastestFee;
      if (fromRec && fromRec > 0) {
        return Math.max(1, Math.ceil(fromRec));
      }
    } catch {
      /* try tip signal */
    }
    try {
      const signal = await this.getNextBlockSignal();
      return Math.max(1, signal.relayFeeSatVb);
    } catch {
      return FALLBACK_FEE_SAT_VB;
    }
  }

  async broadcast(rawHex: string): Promise<string> {
    return this.tryBases(async (base) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      try {
        const res = await fetch(`${base}/tx`, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: rawHex,
          signal: ctrl.signal,
        });
        const body = await res.text();
        if (!res.ok) {
          throw new Error(body || `BROADCAST FAILED (${res.status})`);
        }
        return body.trim();
      } finally {
        clearTimeout(timer);
      }
    }, "BROADCAST");
  }
}

export const esplora = new EsploraClient();
