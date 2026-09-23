/** RCS/02 — commit–reveal + absolute height unlock */

export const RCS2_SEAL_MAGIC = "RCS2";
export const RCS2_REVEAL_MAGIC = "RCS2R";

const MAX_OP_RETURN_DATA = 80;

/** ~1 day / ~7 days of blocks */
export const UNLOCK_PRESETS = [144, 1008] as const;

/**
 * Ritual sats declared in RCS2R OP_RETURN.
 * 546 = classic Bitcoin Core P2PKH dust limit (community marker).
 */
export const REVEAL_DECLARED_SATS = 546;

export type SealPayload = {
  bytes: Uint8Array;
  text: string;
  channel: string;
  declaredSats: number;
  commitHash: string;
  lockHeight: number;
};

export type RevealPayload = {
  bytes: Uint8Array;
  text: string;
  truncated: boolean;
  channel: string;
  declaredSats: number;
  message: string;
};

export type DecodedSeal = {
  kind: "seal";
  channel: string;
  declaredSats: number;
  commitHash: string;
  lockHeight: number;
};

export type DecodedReveal = {
  kind: "reveal";
  channel: string;
  declaredSats: number;
  message: string;
};

export type DecodedRcs02 = DecodedSeal | DecodedReveal;

/** SHA-256 → first 16 bytes as lowercase hex (32 chars) */
export async function commitHashHex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest).slice(0, 16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function encodeSealPayload(params: {
  channel: string;
  declaredSats: number;
  commitHash: string;
  lockHeight: number;
}): SealPayload {
  const ch = params.channel.padStart(2, "0").slice(0, 2);
  const hash = params.commitHash.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hash.length !== 32) {
    throw new Error("COMMIT HASH MUST BE 32 HEX CHARS");
  }
  const lock = Math.floor(params.lockHeight);
  if (!Number.isFinite(lock) || lock <= 0) {
    throw new Error("INVALID LOCK HEIGHT");
  }
  const text = `${RCS2_SEAL_MAGIC}|${ch}|${Math.floor(params.declaredSats)}|${hash}|${lock}`;
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_OP_RETURN_DATA) {
    throw new Error("SEAL PAYLOAD TOO LARGE");
  }
  return {
    bytes,
    text,
    channel: ch,
    declaredSats: Math.floor(params.declaredSats),
    commitHash: hash,
    lockHeight: lock,
  };
}

export function encodeRevealPayload(params: {
  channel: string;
  declaredSats: number;
  message: string;
}): RevealPayload {
  const ch = params.channel.padStart(2, "0").slice(0, 2);
  const satsStr = String(Math.floor(params.declaredSats));
  const prefix = `${RCS2_REVEAL_MAGIC}|${ch}|${satsStr}|`;
  let msg = params.message.replace(/\n/g, " ").trim();
  let truncated = false;
  const encoder = new TextEncoder();
  while (
    encoder.encode(prefix + msg).length > MAX_OP_RETURN_DATA &&
    msg.length > 0
  ) {
    msg = msg.slice(0, -1);
    truncated = true;
  }
  const text = prefix + msg;
  return {
    bytes: encoder.encode(text),
    text,
    truncated,
    channel: ch,
    declaredSats: Math.floor(params.declaredSats),
    message: msg,
  };
}

export function decodeRcs02Payload(data: Uint8Array): DecodedRcs02 | null {
  const text = new TextDecoder().decode(data);
  if (text.startsWith(`${RCS2_REVEAL_MAGIC}|`)) {
    const parts = text.split("|");
    if (parts.length < 4) return null;
    const channel = parts[1] ?? "00";
    const sats = Number(parts[2]);
    if (!Number.isFinite(sats)) return null;
    return {
      kind: "reveal",
      channel,
      declaredSats: sats,
      message: parts.slice(3).join("|"),
    };
  }
  if (text.startsWith(`${RCS2_SEAL_MAGIC}|`)) {
    const parts = text.split("|");
    if (parts.length < 5) return null;
    const channel = parts[1] ?? "00";
    const sats = Number(parts[2]);
    const hash = (parts[3] ?? "").toLowerCase();
    const lock = Number(parts[4]);
    if (!Number.isFinite(sats) || hash.length !== 32 || !Number.isFinite(lock)) {
      return null;
    }
    return {
      kind: "seal",
      channel,
      declaredSats: sats,
      commitHash: hash,
      lockHeight: lock,
    };
  }
  return null;
}
