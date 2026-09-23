import * as bitcoin from "bitcoinjs-lib";
import { BITCOIN_CONFIG } from "../config";
import { ensureEcc } from "../ecc";
import { REVEAL_DECLARED_SATS } from "./rcs02";

/** BIP341 NUMS — unspendable internal key (nothing-up-my-sleeve) */
export const TAPROOT_NUMS_XONLY = Buffer.from(
  "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0",
  "hex",
);

export const TAPLEAF_VERSION = 0xc0;

/** Value locked in the CLTV P2TR output (dust ritual). */
export const LOCK_OUTPUT_SATS = REVEAL_DECLARED_SATS;

export type CltvLockPayment = {
  address: string;
  outputScript: Uint8Array;
  leafScript: Uint8Array;
  controlBlock: Uint8Array;
  xOnlyPub: Uint8Array;
  lockHeight: number;
  redeemVersion: number;
  valueSats: number;
};

function network() {
  return BITCOIN_CONFIG.network === "mainnet"
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

/** Compress or x-only hex → 32-byte x-only. */
export function toXOnlyPubkey(pubkeyHex: string): Buffer {
  const clean = pubkeyHex.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("INVALID PUBKEY HEX");
  }
  const buf = Buffer.from(clean, "hex");
  if (buf.length === 32) return buf;
  if (buf.length === 33 && (buf[0] === 0x02 || buf[0] === 0x03)) {
    return buf.subarray(1);
  }
  if (buf.length === 65 && buf[0] === 0x04) {
    return buf.subarray(1, 33);
  }
  throw new Error("PUBKEY MUST BE 33-BYTE COMPRESSED OR 32-BYTE X-ONLY");
}

/**
 * `<lockHeight> OP_CLTV OP_DROP <xOnly> OP_CHECKSIG`
 * Internal key = NUMS → only script-path spend (hard lock).
 */
export function buildCltvLockPayment(params: {
  lockHeight: number;
  pubkeyHex: string;
  valueSats?: number;
}): CltvLockPayment {
  ensureEcc();
  const lockHeight = Math.floor(params.lockHeight);
  if (!Number.isFinite(lockHeight) || lockHeight <= 0) {
    throw new Error("INVALID LOCK HEIGHT");
  }
  const xOnlyPub = toXOnlyPubkey(params.pubkeyHex);
  const leafScript = bitcoin.script.compile([
    bitcoin.script.number.encode(lockHeight),
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    xOnlyPub,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
  const scriptTree = { output: leafScript };
  const payment = bitcoin.payments.p2tr({
    internalPubkey: TAPROOT_NUMS_XONLY,
    scriptTree,
    redeem: { output: leafScript, redeemVersion: TAPLEAF_VERSION },
    network: network(),
  });
  if (!payment.address || !payment.output || !payment.witness) {
    throw new Error("P2TR CLTV BUILD FAILED");
  }
  const leaf = payment.witness[0];
  const controlBlock = payment.witness[1];
  if (!leaf || !controlBlock) {
    throw new Error("P2TR CONTROL BLOCK MISSING");
  }
  return {
    address: payment.address,
    outputScript: payment.output,
    leafScript: leaf,
    controlBlock,
    xOnlyPub,
    lockHeight,
    redeemVersion: TAPLEAF_VERSION,
    valueSats: params.valueSats ?? LOCK_OUTPUT_SATS,
  };
}

export function hexOf(buf: Uint8Array): string {
  return Buffer.from(buf).toString("hex");
}

export function bufOf(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}
