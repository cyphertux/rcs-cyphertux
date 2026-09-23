import * as bitcoin from "bitcoinjs-lib";
import { BITCOIN_CONFIG, DUST_SATS, anchorSats } from "../config";
import { ensureEcc } from "../ecc";
import type { EsploraUtxo } from "../esplora";
import { encodeRcs01Payload } from "../protocol/rcs01";
import {
  commitHashHex,
  encodeRevealPayload,
  encodeSealPayload,
  REVEAL_DECLARED_SATS,
} from "../protocol/rcs02";
import {
  buildCltvLockPayment,
  hexOf,
  LOCK_OUTPUT_SATS,
  type CltvLockPayment,
} from "../protocol/tapCltv";
import {
  buildOpReturnAnchorPsbt,
  type OpReturnAnchorBuilt,
} from "./buildOpReturnAnchor";

export type BuildPsbtParams = {
  fromAddress: string;
  utxos: EsploraUtxo[];
  declaredSats: number;
  channel: string;
  message: string;
  feeRateSatPerVByte: number;
};

export type BuiltPsbt = OpReturnAnchorBuilt & {
  truncated: boolean;
  message: string;
  channel: string;
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

export type BuiltSealPsbt = OpReturnAnchorBuilt & {
  commitHash: string;
  lockHeight: number;
  channel: string;
  message: string;
  lock: SealLockMeta;
};

export type BuiltRevealPsbt = OpReturnAnchorBuilt & {
  truncated: boolean;
  message: string;
  channel: string;
  lockHeight: number;
  feeInputCount?: number;
};

function network() {
  return BITCOIN_CONFIG.network === "mainnet"
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

/** RCS/01 instant transmission */
export function buildTransmissionPsbt(params: BuildPsbtParams): BuiltPsbt {
  const encoded = encodeRcs01Payload(
    params.channel,
    params.message,
    params.declaredSats,
  );
  const built = buildOpReturnAnchorPsbt({
    fromAddress: params.fromAddress,
    utxos: params.utxos,
    declaredSats: params.declaredSats,
    opReturnBytes: encoded.bytes,
    feeRateSatPerVByte: params.feeRateSatPerVByte,
  });
  return {
    ...built,
    truncated: encoded.truncated,
    message: params.message,
    channel: params.channel.padStart(2, "0").slice(0, 2),
  };
}

/** RCS/02 seal — commit + P2TR CLTV lock output */
export async function buildSealPsbt(params: {
  fromAddress: string;
  utxos: EsploraUtxo[];
  declaredSats: number;
  channel: string;
  message: string;
  lockHeight: number;
  feeRateSatPerVByte: number;
  /** Unisat compressed or x-only pubkey hex */
  pubkeyHex: string;
}): Promise<BuiltSealPsbt> {
  ensureEcc();
  const commitHash = await commitHashHex(params.message);
  const encoded = encodeSealPayload({
    channel: params.channel,
    declaredSats: params.declaredSats,
    commitHash,
    lockHeight: params.lockHeight,
  });
  const lockPay = buildCltvLockPayment({
    lockHeight: params.lockHeight,
    pubkeyHex: params.pubkeyHex,
    valueSats: LOCK_OUTPUT_SATS,
  });
  const built = buildOpReturnAnchorPsbt({
    fromAddress: params.fromAddress,
    utxos: params.utxos,
    declaredSats: params.declaredSats,
    opReturnBytes: encoded.bytes,
    feeRateSatPerVByte: params.feeRateSatPerVByte,
    extraOutputs: [
      {
        script: lockPay.outputScript,
        value: lockPay.valueSats,
      },
    ],
  });
  const lockVout = built.extraOutputVouts?.[0];
  if (lockVout == null) throw new Error("LOCK OUTPUT MISSING");
  return {
    ...built,
    commitHash: encoded.commitHash,
    lockHeight: encoded.lockHeight,
    channel: encoded.channel,
    message: params.message,
    lock: {
      lockAddress: lockPay.address,
      lockVout,
      lockValue: lockPay.valueSats,
      leafScriptHex: hexOf(lockPay.leafScript),
      controlBlockHex: hexOf(lockPay.controlBlock),
      outputScriptHex: hexOf(lockPay.outputScript),
      xOnlyPubHex: hexOf(lockPay.xOnlyPub),
      redeemVersion: lockPay.redeemVersion,
    },
  };
}

/** Legacy soft reveal (no Taproot lock) — kept for old pending seals */
export function buildRevealPsbt(params: {
  fromAddress: string;
  utxos: EsploraUtxo[];
  declaredSats: number;
  channel: string;
  message: string;
  lockHeight: number;
  feeRateSatPerVByte: number;
}): BuiltRevealPsbt {
  const encoded = encodeRevealPayload({
    channel: params.channel,
    declaredSats: params.declaredSats,
    message: params.message,
  });
  const built = buildOpReturnAnchorPsbt({
    fromAddress: params.fromAddress,
    utxos: params.utxos,
    declaredSats: params.declaredSats,
    opReturnBytes: encoded.bytes,
    feeRateSatPerVByte: params.feeRateSatPerVByte,
    lockHeight: params.lockHeight,
  });
  return {
    ...built,
    truncated: encoded.truncated,
    message: encoded.message,
    channel: encoded.channel,
    lockHeight: params.lockHeight,
  };
}

export type LockUtxoSpend = {
  txid: string;
  vout: number;
  value: number;
  leafScriptHex: string;
  controlBlockHex: string;
  outputScriptHex: string;
  xOnlyPubHex: string;
  redeemVersion: number;
};

/**
 * RCS/02 reveal — spend P2TR CLTV lock + OP_RETURN plaintext + sink.
 * Fee paid from P2WPKH utxos; lock value funds the 546 sink.
 */
export function buildRevealFromLockPsbt(params: {
  fromAddress: string;
  feeUtxos: EsploraUtxo[];
  lock: LockUtxoSpend;
  channel: string;
  message: string;
  lockHeight: number;
  feeRateSatPerVByte: number;
  declaredSats?: number;
}): BuiltRevealPsbt {
  ensureEcc();
  const net = network();
  const feeRate = Math.max(1, params.feeRateSatPerVByte);
  const declared = params.declaredSats ?? REVEAL_DECLARED_SATS;
  const anchor = anchorSats(declared);
  const encoded = encodeRevealPayload({
    channel: params.channel,
    declaredSats: declared,
    message: params.message,
  });
  const dataLen = encoded.bytes.length;
  const lockValue = params.lock.value;

  // Rough: 1 p2tr script-path (~100 vB) + n p2wpkh (68) + outs
  const estimate = (feeInputs: number, hasChange: boolean) => {
    const overhead = 10.5;
    const tapIn = 110;
    const wpkh = feeInputs * 68;
    const opReturnOut = 10 + dataLen;
    const sinkOut = 31;
    const changeOut = hasChange ? 31 : 0;
    return Math.ceil(overhead + tapIn + wpkh + opReturnOut + sinkOut + changeOut);
  };

  const sorted = [...params.feeUtxos].sort((a, b) => b.value - a.value);
  const pick: EsploraUtxo[] = [];
  let feeIn = 0;
  let fee = 0;
  let change = 0;
  let vsize = 0;

  // Prefer funding fees from P2WPKH; lock covers anchor when lockValue >= anchor
  const needFromFee = Math.max(0, anchor - lockValue);

  if (sorted.length === 0 && needFromFee + 200 > 0) {
    throw new Error("NO FEE UTXOS — FUND ADDRESS FOR REVEAL FEES");
  }

  const tryPick = () => {
    for (const u of sorted) {
      if (pick.includes(u)) continue;
      pick.push(u);
      feeIn += u.value;
      for (let iter = 0; iter < 4; iter++) {
        const vNo = estimate(pick.length, false);
        const fNo = Math.ceil(vNo * feeRate);
        const totalIn = lockValue + feeIn;
        const rawChange = totalIn - anchor - fNo;
        if (rawChange >= DUST_SATS) {
          vsize = estimate(pick.length, true);
          fee = Math.ceil(vsize * feeRate);
          change = totalIn - anchor - fee;
          if (change < DUST_SATS) {
            vsize = vNo;
            fee = fNo + Math.max(0, totalIn - anchor - fNo);
            change = 0;
          }
        } else if (rawChange >= 0) {
          vsize = vNo;
          fee = fNo + rawChange;
          change = 0;
        } else {
          fee = fNo;
          change = rawChange;
          vsize = vNo;
        }
        if (change >= DUST_SATS || change === 0 || change < 0) break;
      }
      if (lockValue + feeIn >= anchor + fee && change >= 0) return true;
    }
    return lockValue + feeIn >= anchor + fee && change >= 0;
  };

  if (!tryPick()) {
    throw new Error(
      `INSUFFICIENT FUNDS FOR REVEAL — NEED ~${anchor + fee} (LOCK ${lockValue} + FEE UTXO ${feeIn})`,
    );
  }

  const psbt = new bitcoin.Psbt({ network: net });
  psbt.setLocktime(params.lockHeight);

  const leafScript = Buffer.from(params.lock.leafScriptHex, "hex");
  const controlBlock = Buffer.from(params.lock.controlBlockHex, "hex");
  const outputScript = Buffer.from(params.lock.outputScriptHex, "hex");

  psbt.addInput({
    hash: params.lock.txid,
    index: params.lock.vout,
    sequence: 0xfffffffe,
    witnessUtxo: {
      script: outputScript,
      value: BigInt(lockValue),
    },
    tapLeafScript: [
      {
        leafVersion: params.lock.redeemVersion,
        script: leafScript,
        controlBlock,
      },
    ],
  });

  for (const u of pick) {
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      sequence: 0xfffffffe,
      witnessUtxo: {
        script: bitcoin.address.toOutputScript(params.fromAddress, net),
        value: BigInt(u.value),
      },
    });
  }

  const embed = bitcoin.payments.embed({
    data: [Buffer.from(encoded.bytes)],
  });
  if (!embed.output) throw new Error("OP_RETURN BUILD FAILED");
  psbt.addOutput({ script: embed.output, value: BigInt(0) });
  psbt.addOutput({
    address: BITCOIN_CONFIG.protocolSink,
    value: BigInt(anchor),
  });
  if (change >= DUST_SATS) {
    psbt.addOutput({
      address: params.fromAddress,
      value: BigInt(change),
    });
  }

  return {
    psbtBase64: psbt.toBase64(),
    declaredSats: declared,
    anchor,
    feeSats: fee,
    totalSats: anchor + fee,
    changeSats: change >= DUST_SATS ? change : 0,
    inputSats: lockValue + feeIn,
    feeRateSatVb: feeRate,
    vsize,
    lockHeight: params.lockHeight,
    truncated: encoded.truncated,
    message: encoded.message,
    channel: encoded.channel,
    feeInputCount: pick.length,
  };
}

export type { CltvLockPayment };
