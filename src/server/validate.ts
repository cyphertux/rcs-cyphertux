/** Shared request validation for RCS API routes (testnet). */

const TXID_RE = /^[0-9a-fA-F]{64}$/;
const HEX_RE = /^[0-9a-fA-F]+$/;

/** Native segwit / taproot testnet4-ish bech32 */
const TESTNET_BECH32_RE = /^tb1[0-9a-z]{8,90}$/i;

export const MAX_MESSAGE_LEN = 140;
export const MAX_SATS = 21_000_000; // 0.21 tBTC ritual cap
export const MAX_SIGNED_CHARS = 200_000; // ~100 KB hex / large PSBT
export const MAX_WALLET_UTXOS = 40;

export function isTxid(v: unknown): v is string {
  return typeof v === "string" && TXID_RE.test(v);
}

export function isTestnetAddress(v: unknown): v is string {
  return typeof v === "string" && TESTNET_BECH32_RE.test(v.trim());
}

export function isPositiveSats(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    Number.isInteger(v) &&
    v > 0 &&
    v <= MAX_SATS
  );
}

export function isMessage(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_MESSAGE_LEN;
}

export function isHex(v: unknown, minLen = 2, maxLen = 20_000): v is string {
  return (
    typeof v === "string" &&
    v.length >= minLen &&
    v.length <= maxLen &&
    v.length % 2 === 0 &&
    HEX_RE.test(v)
  );
}

export function sanitizeClientError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const msg = e.message.slice(0, 160);
  // Don't leak long upstream HTML / stack noise
  if (/<!DOCTYPE|html>|Exception|at\s+\//i.test(msg)) return fallback;
  return msg || fallback;
}
