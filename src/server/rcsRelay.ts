import * as bitcoin from "bitcoinjs-lib";
import {
  BITCOIN_CONFIG,
  PROTOCOL_MAGIC,
  PROTOCOL_MAGIC_REVEAL,
  PROTOCOL_MAGIC_SEAL,
} from "@/bitcoin/config";
import { toRawTxHex } from "@/bitcoin/psbt/finalize";
import { MAX_SIGNED_CHARS } from "@/server/validate";

function network() {
  return BITCOIN_CONFIG.network === "mainnet"
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

function opReturnText(script: Buffer): string | null {
  if (script.length < 2 || script[0] !== 0x6a) return null;
  let i = 1;
  const chunks: number[] = [];
  while (i < script.length) {
    const op = script[i]!;
    i += 1;
    if (op >= 1 && op <= 75) {
      for (let j = 0; j < op && i < script.length; j++, i++) {
        chunks.push(script[i]!);
      }
    } else if (op === 0x4c && i < script.length) {
      const len = script[i]!;
      i += 1;
      for (let j = 0; j < len && i < script.length; j++, i++) {
        chunks.push(script[i]!);
      }
    } else {
      break;
    }
  }
  if (!chunks.length) return null;
  try {
    return new TextDecoder().decode(Uint8Array.from(chunks));
  } catch {
    return null;
  }
}

function isRcsPayload(text: string): boolean {
  return (
    text.startsWith(`${PROTOCOL_MAGIC}|`) ||
    text.startsWith(`${PROTOCOL_MAGIC_SEAL}|`) ||
    text.startsWith(`${PROTOCOL_MAGIC_REVEAL}|`)
  );
}

/**
 * Parse wallet-signed payload → raw tx hex, then require RCS OP_RETURN + sink out.
 * Rejects arbitrary non-protocol relays.
 */
export function extractAndAssertRcsTx(signed: string): string {
  if (signed.length > MAX_SIGNED_CHARS) {
    throw new Error("PAYLOAD TOO LARGE");
  }
  let hex: string;
  try {
    hex = toRawTxHex(signed);
  } catch {
    throw new Error("INVALID SIGNED PAYLOAD");
  }
  if (hex.length > MAX_SIGNED_CHARS || hex.length % 2 !== 0) {
    throw new Error("TX TOO LARGE");
  }

  let tx: bitcoin.Transaction;
  try {
    tx = bitcoin.Transaction.fromHex(hex);
  } catch {
    throw new Error("INVALID TX");
  }

  const net = network();
  let hasRcs = false;
  let hasSink = false;
  for (const out of tx.outs) {
    const text = opReturnText(Buffer.from(out.script));
    if (text && isRcsPayload(text)) hasRcs = true;
    try {
      const addr = bitcoin.address.fromOutputScript(
        Buffer.from(out.script),
        net,
      );
      if (addr === BITCOIN_CONFIG.protocolSink) hasSink = true;
    } catch {
      /* non-standard / OP_RETURN */
    }
  }

  if (!hasRcs) throw new Error("NOT AN RCS TX");
  if (!hasSink) throw new Error("MISSING PROTOCOL SINK");
  return hex;
}
