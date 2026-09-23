import * as bitcoin from "bitcoinjs-lib";
import { BITCOIN_CONFIG } from "../config";

function network() {
  return BITCOIN_CONFIG.network === "mainnet"
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

function looksLikeHex(s: string): boolean {
  return /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
}

function base64ToHex(b64: string): string {
  const bin = atob(b64);
  let hex = "";
  for (let i = 0; i < bin.length; i++) {
    hex += bin.charCodeAt(i)!.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Accept signed PSBT (base64 or hex) or raw tx hex; return raw tx hex */
export function toRawTxHex(signed: string): string {
  const trimmed = signed.trim();

  // Raw transaction (no PSBT magic)
  if (looksLikeHex(trimmed) && !trimmed.toLowerCase().startsWith("70736274ff")) {
    // Heuristic: finalized tx typically starts with version 01000000 / 02000000
    if (
      trimmed.startsWith("01000000") ||
      trimmed.startsWith("02000000") ||
      trimmed.startsWith("00000000")
    ) {
      return trimmed;
    }
  }

  const psbtBase64 = looksLikeHex(trimmed)
    ? Buffer.from(trimmed, "hex").toString("base64")
    : trimmed.includes("-") || trimmed.includes("_")
      ? trimmed // unlikely
      : trimmed;

  const asBase64 = looksLikeHex(trimmed) && trimmed.toLowerCase().startsWith("70736274")
    ? Buffer.from(trimmed, "hex").toString("base64")
    : looksLikeHex(trimmed)
      ? Buffer.from(trimmed, "hex").toString("base64")
      : trimmed;

  void psbtBase64;
  const psbt = bitcoin.Psbt.fromBase64(
    looksLikeHex(trimmed) && trimmed.toLowerCase().startsWith("70736274")
      ? Buffer.from(trimmed, "hex").toString("base64")
      : asBase64.startsWith("cHNidP") || !looksLikeHex(trimmed)
        ? trimmed
        : Buffer.from(trimmed, "hex").toString("base64"),
    { network: network() },
  );

  try {
    psbt.finalizeAllInputs();
  } catch {
    // already finalized by wallet
  }
  return psbt.extractTransaction().toHex();
}

export function hexFromWalletSigned(signedPsbtBase64OrHex: string): string {
  try {
    return toRawTxHex(signedPsbtBase64OrHex);
  } catch {
    if (looksLikeHex(signedPsbtBase64OrHex)) {
      return signedPsbtBase64OrHex;
    }
    return base64ToHex(signedPsbtBase64OrHex);
  }
}
