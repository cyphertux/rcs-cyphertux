import { formatTime } from "@/domain/format";
import type { MemoryEntry } from "@/domain/memory";
import { BITCOIN_CONFIG, FALLBACK_FEE_SAT_VB } from "./config";
import { esplora, type EsploraUtxo } from "./esplora";
import { indexMemory, invalidateMemoryCache } from "./memory/indexer";
import {
  buildRevealFromLockPsbt,
  buildRevealPsbt,
  buildSealPsbt,
  buildTransmissionPsbt,
} from "./psbt/buildTransmission";
import type {
  BitcoinProvider,
  BroadcastResult,
  ConfirmationResult,
  PreparedTransmission,
  SealLockMeta,
  SystemChainStatus,
} from "./types";
import { extractAndAssertRcsTx } from "@/server/rcsRelay";

type UtxoInput = {
  fromAddress: string;
  walletUtxos?: EsploraUtxo[];
};

export class BitcoinTestnetProvider implements BitcoinProvider {
  async getStatus(): Promise<SystemChainStatus> {
    const empty: SystemChainStatus = {
      networkLabel: BITCOIN_CONFIG.networkDisplayName,
      channel: BITCOIN_CONFIG.defaultChannel,
      nodeStatus: "OFFLINE",
      blockHeight: 0,
      queueSize: 0,
      time: formatTime(),
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
    };

    try {
      const signal = await esplora.getNextBlockSignal();
      return {
        networkLabel: BITCOIN_CONFIG.networkDisplayName,
        channel: BITCOIN_CONFIG.defaultChannel,
        nodeStatus: signal.projectionOk ? "ONLINE" : "DEGRADED",
        blockHeight: signal.tipHeight,
        queueSize: signal.mempoolTx,
        time: formatTime(),
        feeRateSatVb: signal.relayFeeSatVb,
        nextFeeSatVb: signal.nextFeeSatVb,
        nextFeeMin: signal.nextFeeMin,
        nextFeeMax: signal.nextFeeMax,
        nextBlockTx: signal.nextBlockTx,
        nextBlockVsize: signal.nextBlockVsize,
        nextTotalFees: signal.nextTotalFees,
        mempoolVsize: signal.mempoolVsize,
        mempoolTotalFee: signal.mempoolTotalFee,
        mempoolFill: signal.fillRatio,
        tipAgeSec: signal.tipAgeSec,
      };
    } catch {
      return empty;
    }
  }

  async getBlockHeight(): Promise<number> {
    return esplora.getTipHeight();
  }

  private async resolveUtxos(input: UtxoInput): Promise<EsploraUtxo[]> {
    if (BITCOIN_CONFIG.network !== "testnet") {
      throw new Error("PROVIDER MISMATCH — EXPECT TESTNET");
    }
    let utxos: EsploraUtxo[];
    try {
      utxos = await esplora.getAddressUtxos(input.fromAddress);
    } catch (e) {
      if (input.walletUtxos && input.walletUtxos.length > 0) {
        utxos = input.walletUtxos;
      } else {
        throw e instanceof Error ? e : new Error("ESPLORA UTXO UNREACHABLE");
      }
    }
    if (utxos.length === 0) throw new Error("NO UTXO — FUND WALLET");
    return utxos;
  }

  private async feeRate(): Promise<number> {
    try {
      return await esplora.recommendFeeRate();
    } catch {
      return FALLBACK_FEE_SAT_VB;
    }
  }

  private toPrepared(
    built: {
      declaredSats: number;
      anchor: number;
      feeSats: number;
      totalSats: number;
      changeSats: number;
      inputSats: number;
      feeRateSatVb: number;
      psbtBase64: string;
    },
    extras: {
      channel: string;
      message: string;
      truncated: boolean;
      commitHash?: string;
      lockHeight?: number;
      lock?: SealLockMeta;
      signHints?: PreparedTransmission["signHints"];
    },
  ): PreparedTransmission {
    return {
      declaredSats: built.declaredSats,
      anchorSats: built.anchor,
      feeSats: built.feeSats,
      totalSats: built.totalSats,
      changeSats: built.changeSats,
      inputSats: built.inputSats,
      feeRateSatVb: built.feeRateSatVb,
      channel: extras.channel,
      message: extras.message,
      truncated: extras.truncated,
      psbtBase64: built.psbtBase64,
      commitHash: extras.commitHash,
      lockHeight: extras.lockHeight,
      lock: extras.lock,
      signHints: extras.signHints,
      summary: {
        value: built.declaredSats,
        anchor: built.anchor,
        fee: built.feeSats,
        total: built.totalSats,
        change: built.changeSats,
      },
    };
  }

  async prepareTransmission(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    walletUtxos?: EsploraUtxo[];
  }): Promise<PreparedTransmission> {
    const utxos = await this.resolveUtxos(input);
    const feeRate = await this.feeRate();
    const built = buildTransmissionPsbt({
      fromAddress: input.fromAddress,
      utxos,
      declaredSats: input.sats,
      channel: input.channel,
      message: input.message,
      feeRateSatPerVByte: feeRate,
    });
    return this.toPrepared(built, {
      channel: built.channel,
      message: built.message,
      truncated: built.truncated,
    });
  }

  async prepareSeal(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    lockHeight: number;
    pubkeyHex: string;
    walletUtxos?: EsploraUtxo[];
  }): Promise<PreparedTransmission> {
    if (!input.pubkeyHex) throw new Error("PUBKEY REQUIRED FOR TAPROOT LOCK");
    const utxos = await this.resolveUtxos(input);
    const feeRate = await this.feeRate();
    const built = await buildSealPsbt({
      fromAddress: input.fromAddress,
      utxos,
      declaredSats: input.sats,
      channel: input.channel,
      message: input.message,
      lockHeight: input.lockHeight,
      feeRateSatPerVByte: feeRate,
      pubkeyHex: input.pubkeyHex,
    });
    return this.toPrepared(built, {
      channel: built.channel,
      message: built.message,
      truncated: false,
      commitHash: built.commitHash,
      lockHeight: built.lockHeight,
      lock: built.lock,
    });
  }

  async prepareReveal(input: {
    message: string;
    sats: number;
    channel: string;
    fromAddress: string;
    lockHeight: number;
    lockSpend?: SealLockMeta & { txid: string };
    walletUtxos?: EsploraUtxo[];
  }): Promise<PreparedTransmission> {
    const tip = await this.getBlockHeight().catch(() => 0);
    if (tip > 0 && tip < input.lockHeight) {
      throw new Error(`LOCKED — TIP ${tip} < ${input.lockHeight}`);
    }
    const utxos = await this.resolveUtxos(input);
    const feeRate = await this.feeRate();

    if (input.lockSpend?.leafScriptHex && input.lockSpend.controlBlockHex) {
      const built = buildRevealFromLockPsbt({
        fromAddress: input.fromAddress,
        feeUtxos: utxos,
        lock: {
          txid: input.lockSpend.txid,
          vout: input.lockSpend.lockVout,
          value: input.lockSpend.lockValue,
          leafScriptHex: input.lockSpend.leafScriptHex,
          controlBlockHex: input.lockSpend.controlBlockHex,
          outputScriptHex: input.lockSpend.outputScriptHex,
          xOnlyPubHex: input.lockSpend.xOnlyPubHex,
          redeemVersion: input.lockSpend.redeemVersion,
        },
        channel: input.channel,
        message: input.message,
        lockHeight: input.lockHeight,
        feeRateSatPerVByte: feeRate,
        declaredSats: input.sats,
      });
      return this.toPrepared(built, {
        channel: built.channel,
        message: built.message,
        truncated: built.truncated,
        lockHeight: built.lockHeight,
        signHints: {
          tapInputIndexes: [0],
          feeInputIndexes: Array.from(
            { length: built.feeInputCount ?? 0 },
            (_, i) => i + 1,
          ),
          pubkeyHex: input.lockSpend.xOnlyPubHex,
        },
      });
    }

    const built = buildRevealPsbt({
      fromAddress: input.fromAddress,
      utxos,
      declaredSats: input.sats,
      channel: input.channel,
      message: input.message,
      lockHeight: input.lockHeight,
      feeRateSatPerVByte: feeRate,
    });
    return this.toPrepared(built, {
      channel: built.channel,
      message: built.message,
      truncated: built.truncated,
      lockHeight: built.lockHeight,
    });
  }

  async broadcastSignedPsbt(signedPsbtBase64: string): Promise<BroadcastResult> {
    const hex = extractAndAssertRcsTx(signedPsbtBase64);
    return this.broadcastRawHex(hex);
  }

  async broadcastRawHex(rawHex: string): Promise<BroadcastResult> {
    const txid = await esplora.broadcast(rawHex);
    invalidateMemoryCache();
    return { txid, status: "PENDING" };
  }

  async getTransmissionStatus(txid: string): Promise<ConfirmationResult> {
    try {
      const tx = await esplora.getTx(txid);
      if (tx.status.confirmed) {
        invalidateMemoryCache();
        return {
          txid,
          status: "CONFIRMED",
          blockHeight: tx.status.block_height,
        };
      }
      return { txid, status: "PENDING" };
    } catch {
      return { txid, status: "FAILED" };
    }
  }

  async listMemory(): Promise<MemoryEntry[]> {
    return indexMemory(esplora);
  }

  async getMemoryById(id: string): Promise<MemoryEntry | null> {
    const all = await this.listMemory();
    return all.find((e) => e.id === id || e.id === id.padStart(6, "0")) ?? null;
  }

  async getMemoryByTxid(txid: string): Promise<MemoryEntry | null> {
    const all = await this.listMemory();
    return all.find((e) => e.txid === txid) ?? null;
  }
}

export function createTestnetProvider(): BitcoinTestnetProvider {
  return new BitcoinTestnetProvider();
}
