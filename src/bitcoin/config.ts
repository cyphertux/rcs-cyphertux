export type BitcoinNetworkId = "testnet" | "mainnet";

export const PROTOCOL_VERSION = "RCS/02" as const;
export const PROTOCOL_MAGIC = "RCS1";
export const PROTOCOL_MAGIC_SEAL = "RCS2";
export const PROTOCOL_MAGIC_REVEAL = "RCS2R";

/** Standard dust floor for V4 relay safety */
export const DUST_SATS = 546;

/** Rough min balance to attempt a transmission (dust + fee headroom) */
export const MIN_TRANSMIT_SATS = DUST_SATS + 400;

/** Fee rate when every Esplora fee endpoint is down */
export const FALLBACK_FEE_SAT_VB = 2;

const defaultEsplora =
  process.env.NEXT_PUBLIC_BITCOIN_NETWORK === "mainnet"
    ? "https://mempool.space/api"
    : "https://mempool.space/testnet4/api";

const primaryEsplora = process.env.NEXT_PUBLIC_ESPLORA_URL ?? defaultEsplora;

/**
 * Built-in mirrors tried after primary when env FALLBACKS is empty.
 * Mainnet has public Blockstream Esplora; Testnet4 public mirrors are scarce —
 * operators should set NEXT_PUBLIC_ESPLORA_FALLBACKS for extra hosts.
 */
const BUILTIN_FALLBACKS: string[] =
  process.env.NEXT_PUBLIC_BITCOIN_NETWORK === "mainnet"
    ? ["https://blockstream.info/api", "https://mempool.space/api"]
    : [
        // Distinct host if someone points primary elsewhere; deduped below
        "https://mempool.space/testnet4/api",
      ];

const fallbackRaw = process.env.NEXT_PUBLIC_ESPLORA_FALLBACKS ?? "";
const fromEnv = fallbackRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const fallbackSource = fromEnv.length > 0 ? fromEnv : BUILTIN_FALLBACKS;
const fallbackList = fallbackSource.filter((u) => u !== primaryEsplora);

export const BITCOIN_CONFIG = {
  network: (process.env.NEXT_PUBLIC_BITCOIN_NETWORK === "mainnet"
    ? "mainnet"
    : "testnet") as BitcoinNetworkId,
  useMock: process.env.NEXT_PUBLIC_BITCOIN_PROVIDER === "mock",
  mainnetEnabled: process.env.NEXT_PUBLIC_MAINNET_ENABLED === "true",
  esploraBase: primaryEsplora,
  /** Tried in order if primary fails */
  esploraFallbacks: fallbackList,
  protocolSink:
    process.env.NEXT_PUBLIC_PROTOCOL_SINK_ADDRESS ??
    "tb1qtx6zuvpf3tdt2ymtdzwrma8sclr2w2wy90lvvd",
  defaultChannel: "07",
  dustSats: DUST_SATS,
  unisatChain: "BITCOIN_TESTNET4" as const,
  networkDisplayName: "BITCOIN TESTNET4",
  mempoolTxBase:
    process.env.NEXT_PUBLIC_BITCOIN_NETWORK === "mainnet"
      ? "https://mempool.space/tx/"
      : "https://mempool.space/testnet4/tx/",
  mempoolAddressBase:
    process.env.NEXT_PUBLIC_BITCOIN_NETWORK === "mainnet"
      ? "https://mempool.space/address/"
      : "https://mempool.space/testnet4/address/",
} as const;

export function anchorSats(declared: number): number {
  return Math.max(declared, BITCOIN_CONFIG.dustSats);
}

/** All Esplora bases to try (primary first, then fallbacks; de-duped) */
export function esploraBases(): string[] {
  const out: string[] = [];
  for (const u of [
    BITCOIN_CONFIG.esploraBase,
    ...BITCOIN_CONFIG.esploraFallbacks,
  ]) {
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}
