import { BITCOIN_CONFIG, DUST_SATS, PROTOCOL_MAGIC } from "../config";

export type EncodedPayload = {
  bytes: Uint8Array;
  text: string;
  truncated: boolean;
  declaredSats: number;
};

const MAX_OP_RETURN_DATA = 80;

export function anchorFor(declared: number): number {
  return Math.max(declared, DUST_SATS);
}

/**
 * RCS1|<channel>|<declaredSats>|<message>
 * Backward compatible decode: older RCS1|ch|message (no sats field)
 */
export function encodeRcs01Payload(
  channel: string,
  message: string,
  declaredSats: number,
): EncodedPayload {
  const ch = channel.padStart(2, "0").slice(0, 2);
  const satsStr = String(Math.floor(declaredSats));
  const prefix = `${PROTOCOL_MAGIC}|${ch}|${satsStr}|`;
  let msg = message.replace(/\n/g, " ").trim();
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
    declaredSats: Math.floor(declaredSats),
  };
}

export function decodeRcs01Payload(data: Uint8Array): {
  channel: string;
  message: string;
  declaredSats: number | null;
} | null {
  const text = new TextDecoder().decode(data);
  if (!text.startsWith(`${PROTOCOL_MAGIC}|`)) return null;
  const parts = text.split("|");
  if (parts.length < 3) return null;
  const channel = parts[1] ?? "00";

  // New: RCS1|ch|sats|message
  if (parts.length >= 4 && /^\d+$/.test(parts[2] ?? "")) {
    return {
      channel,
      declaredSats: Number(parts[2]),
      message: parts.slice(3).join("|"),
    };
  }

  // Legacy: RCS1|ch|message
  return {
    channel,
    declaredSats: null,
    message: parts.slice(2).join("|"),
  };
}

export function isTestnetConfigured(): boolean {
  return BITCOIN_CONFIG.network === "testnet";
}
