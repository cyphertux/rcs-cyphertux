import * as bitcoin from "bitcoinjs-lib";
import { BITCOIN_CONFIG, DUST_SATS, anchorSats } from "../config";
import type { EsploraUtxo } from "../esplora";

function network() {
  return BITCOIN_CONFIG.network === "mainnet"
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

function toBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data);
}

export type ExtraOutput = {
  address?: string;
  script?: Uint8Array;
  value: number;
};

export type OpReturnAnchorParams = {
  fromAddress: string;
  utxos: EsploraUtxo[];
  declaredSats: number;
  opReturnBytes: Uint8Array;
  feeRateSatPerVByte: number;
  /** Absolute locktime (block height) — BIP65-style via tx nLockTime */
  lockHeight?: number;
  /** Additional outputs before change (e.g. P2TR CLTV lock) */
  extraOutputs?: ExtraOutput[];
};

export type OpReturnAnchorBuilt = {
  psbtBase64: string;
  declaredSats: number;
  anchor: number;
  feeSats: number;
  totalSats: number;
  changeSats: number;
  inputSats: number;
  feeRateSatVb: number;
  vsize: number;
  lockHeight?: number;
  /** Vout index of each extra output (after OP_RETURN + sink) */
  extraOutputVouts?: number[];
};

function extraOutputsVb(extras: ExtraOutput[]): number {
  let n = 0;
  for (const e of extras) {
    if (e.script) {
      // value(8) + scriptlen(1) + script
      n += 8 + 1 + e.script.length;
    } else {
      // P2WPKH/P2TR-ish: ~31–43; use 43 for safety
      n += 43;
    }
  }
  return n;
}

function estimateVsize(params: {
  inputCount: number;
  opReturnDataLen: number;
  hasChange: boolean;
  extras: ExtraOutput[];
}): number {
  const overhead = 10.5;
  const inVb = params.inputCount * 68;
  const sinkOut = 31;
  const opReturnOut = 10 + params.opReturnDataLen;
  const changeOut = params.hasChange ? 31 : 0;
  return Math.ceil(
    overhead +
      inVb +
      sinkOut +
      opReturnOut +
      changeOut +
      extraOutputsVb(params.extras),
  );
}

function extrasSum(extras: ExtraOutput[]): number {
  return extras.reduce((s, e) => s + e.value, 0);
}

/** Shared OP_RETURN + sink anchor + optional extras + change PSBT builder */
export function buildOpReturnAnchorPsbt(
  params: OpReturnAnchorParams,
): OpReturnAnchorBuilt {
  const net = network();
  const feeRate = Math.max(1, params.feeRateSatPerVByte);
  const anchor = anchorSats(params.declaredSats);
  const dataLen = params.opReturnBytes.length;
  const extras = params.extraOutputs ?? [];
  const extrasTotal = extrasSum(extras);

  const sorted = [...params.utxos].sort((a, b) => b.value - a.value);
  if (sorted.length === 0) {
    throw new Error("NO UTXOS — FUND TESTNET ADDRESS");
  }

  const pick: EsploraUtxo[] = [];
  let totalIn = 0;
  let fee = 0;
  let change = 0;
  let vsize = 0;

  for (const u of sorted) {
    pick.push(u);
    totalIn += u.value;

    for (let iter = 0; iter < 4; iter++) {
      const vNoChange = estimateVsize({
        inputCount: pick.length,
        opReturnDataLen: dataLen,
        hasChange: false,
        extras,
      });
      const feeNoChange = Math.ceil(vNoChange * feeRate);
      const rawChange = totalIn - anchor - extrasTotal - feeNoChange;

      if (rawChange >= DUST_SATS) {
        vsize = estimateVsize({
          inputCount: pick.length,
          opReturnDataLen: dataLen,
          hasChange: true,
          extras,
        });
        fee = Math.ceil(vsize * feeRate);
        change = totalIn - anchor - extrasTotal - fee;
        if (change < DUST_SATS) {
          vsize = vNoChange;
          fee =
            feeNoChange +
            Math.max(0, totalIn - anchor - extrasTotal - feeNoChange);
          change = 0;
        }
      } else if (rawChange >= 0) {
        vsize = vNoChange;
        fee = feeNoChange + rawChange;
        change = 0;
      } else {
        fee = feeNoChange;
        change = rawChange;
        vsize = vNoChange;
      }

      if (change >= DUST_SATS || change === 0 || change < 0) break;
    }

    if (totalIn >= anchor + extrasTotal + fee && change >= 0) break;
  }

  if (change < 0 || totalIn < anchor + extrasTotal + fee) {
    throw new Error(
      `INSUFFICIENT FUNDS — NEED ${anchor + extrasTotal + fee} SAT (HAVE ${totalIn})`,
    );
  }

  const lockHeight = params.lockHeight;
  const psbt = new bitcoin.Psbt({ network: net });
  if (lockHeight != null && lockHeight > 0) {
    psbt.setLocktime(lockHeight);
  }

  for (const u of pick) {
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      sequence: lockHeight != null && lockHeight > 0 ? 0xfffffffe : undefined,
      witnessUtxo: {
        script: bitcoin.address.toOutputScript(params.fromAddress, net),
        value: BigInt(u.value),
      },
    });
  }

  const embed = bitcoin.payments.embed({
    data: [toBuffer(params.opReturnBytes)],
  });
  if (!embed.output) throw new Error("OP_RETURN BUILD FAILED");

  psbt.addOutput({ script: embed.output, value: BigInt(0) });
  psbt.addOutput({
    address: BITCOIN_CONFIG.protocolSink,
    value: BigInt(anchor),
  });

  const extraOutputVouts: number[] = [];
  for (const e of extras) {
    extraOutputVouts.push(psbt.txOutputs.length);
    if (e.script) {
      psbt.addOutput({ script: toBuffer(e.script), value: BigInt(e.value) });
    } else if (e.address) {
      psbt.addOutput({ address: e.address, value: BigInt(e.value) });
    } else {
      throw new Error("EXTRA OUTPUT NEEDS ADDRESS OR SCRIPT");
    }
  }

  if (change >= DUST_SATS) {
    psbt.addOutput({
      address: params.fromAddress,
      value: BigInt(change),
    });
  }

  return {
    psbtBase64: psbt.toBase64(),
    declaredSats: params.declaredSats,
    anchor,
    feeSats: fee,
    totalSats: anchor + extrasTotal + fee,
    changeSats: change >= DUST_SATS ? change : 0,
    inputSats: totalIn,
    feeRateSatVb: feeRate,
    vsize,
    lockHeight,
    extraOutputVouts: extras.length ? extraOutputVouts : undefined,
  };
}
