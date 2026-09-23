export type WalletAccount = {
  address: string;
  balanceSats: number;
};

export type WalletUtxo = {
  txid: string;
  vout: number;
  value: number;
};

export type SignPsbtOptions = {
  autoFinalized?: boolean;
  toSignInputs?: Array<{
    index: number;
    address?: string;
    publicKey?: string;
    useTweakedSigner?: boolean;
    disableTweakSigner?: boolean;
  }>;
};

export interface WalletAdapter {
  id: string;
  label: string;
  isAvailable(): boolean;
  connect(): Promise<string>;
  getAddress(): Promise<string>;
  getBalance(): Promise<number>;
  getPublicKey?(): Promise<string>;
  /** Returns signed PSBT base64 (or raw tx hex from some builds) */
  signPsbt(psbtBase64: string, options?: SignPsbtOptions): Promise<string>;
  /** Broadcast signed PSBT hex via wallet peers — optional */
  pushPsbt?(psbtOrTxHex: string): Promise<string>;
  /** UTXOs from wallet index — optional prepare fallback */
  getUtxos?(): Promise<WalletUtxo[]>;
  disconnect(): Promise<void>;
}

declare global {
  interface Window {
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      getBalance: () => Promise<{
        confirmed: number;
        unconfirmed: number;
        total: number;
      }>;
      getPublicKey?: () => Promise<string>;
      signPsbt: (
        psbtHex: string,
        options?: {
          autoFinalized?: boolean;
          toSignInputs?: Array<{
            index: number;
            address?: string;
            publicKey?: string;
            useTweakedSigner?: boolean;
            disableTweakSigner?: boolean;
          }>;
        },
      ) => Promise<string>;
      pushPsbt?: (psbtHex: string) => Promise<string>;
      pushTx?: (rawTx: string) => Promise<string>;
      getBitcoinUtxos?: () => Promise<
        Array<{
          txid: string;
          vout: number;
          satoshis?: number;
          value?: number;
        }>
      >;
      getNetwork?: () => Promise<string>;
      switchNetwork?: (network: "livenet" | "testnet") => Promise<void>;
      switchChain?: (chain: string) => Promise<{ network: string }>;
      getChain?: () => Promise<{ enum: string; name: string; network: string }>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

function base64ToHex(b64: string): string {
  const bin = atob(b64);
  let hex = "";
  for (let i = 0; i < bin.length; i++) {
    hex += bin.charCodeAt(i)!.toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function looksLikeHex(s: string): boolean {
  return /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
}

/** Unisat injects asynchronously after page load */
export function waitForUnisat(timeoutMs = 4000): Promise<NonNullable<Window["unisat"]>> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("NO WINDOW"));
      return;
    }
    if (window.unisat) {
      resolve(window.unisat);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      if (window.unisat) {
        window.clearInterval(id);
        resolve(window.unisat);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        window.clearInterval(id);
        reject(new Error("WALLET NOT FOUND — INSTALL / UNLOCK UNISAT"));
      }
    }, 100);
  });
}

async function ensureTestnet(unisat: NonNullable<Window["unisat"]>): Promise<void> {
  const chains = ["BITCOIN_TESTNET4", "BITCOIN_TESTNET"] as const;
  for (const chain of chains) {
    try {
      if (unisat.switchChain) {
        await unisat.switchChain(chain);
        return;
      }
    } catch {
      // try next
    }
  }
  try {
    if (unisat.switchNetwork) {
      const current = unisat.getNetwork ? await unisat.getNetwork() : null;
      if (current !== "testnet") {
        await unisat.switchNetwork("testnet");
      }
    }
  } catch {
    // User may reject — still allow connect; prepare will fail if wrong network
  }
}

export const unisatAdapter: WalletAdapter = {
  id: "unisat",
  label: "UNISAT",

  isAvailable() {
    return typeof window !== "undefined" && Boolean(window.unisat);
  },

  async connect() {
    const unisat = await waitForUnisat();
    await ensureTestnet(unisat);
    const accounts = await unisat.requestAccounts();
    const addr = accounts[0];
    if (!addr) throw new Error("NO ACCOUNT — UNLOCK UNISAT");
    return addr;
  },

  async getAddress() {
    const unisat = await waitForUnisat();
    const accounts = await unisat.getAccounts();
    const addr = accounts[0];
    if (!addr) throw new Error("NOT CONNECTED");
    return addr;
  },

  async getBalance() {
    const unisat = await waitForUnisat();
    const bal = await unisat.getBalance();
    return bal.total ?? bal.confirmed ?? 0;
  },

  async getPublicKey() {
    const unisat = await waitForUnisat();
    if (!unisat.getPublicKey) throw new Error("WALLET PUBKEY UNAVAILABLE");
    return unisat.getPublicKey();
  },

  async signPsbt(psbtBase64: string, options?: SignPsbtOptions) {
    const unisat = await waitForUnisat();
    const psbtHex = base64ToHex(psbtBase64);
    const signedHex = await unisat.signPsbt(psbtHex, {
      autoFinalized: options?.autoFinalized ?? true,
      toSignInputs: options?.toSignInputs,
    });
    if (signedHex.toLowerCase().startsWith("70736274ff")) {
      return hexToBase64(signedHex);
    }
    if (
      signedHex.startsWith("01000000") ||
      signedHex.startsWith("02000000")
    ) {
      return signedHex;
    }
    try {
      return hexToBase64(signedHex);
    } catch {
      return signedHex;
    }
  },

  async pushPsbt(psbtOrTxHex: string) {
    const unisat = await waitForUnisat();
    let hex = psbtOrTxHex.trim();
    if (!looksLikeHex(hex)) {
      hex = base64ToHex(hex);
    }

    // Raw tx → pushTx when available
    const isRawTx =
      !hex.toLowerCase().startsWith("70736274ff") &&
      (hex.startsWith("01000000") ||
        hex.startsWith("02000000") ||
        hex.startsWith("00000000"));

    if (isRawTx && unisat.pushTx) {
      return unisat.pushTx(hex);
    }
    if (unisat.pushPsbt) {
      return unisat.pushPsbt(hex);
    }
    if (unisat.pushTx) {
      return unisat.pushTx(hex);
    }
    throw new Error("WALLET PUSH UNAVAILABLE — UPDATE UNISAT");
  },

  async getUtxos() {
    const unisat = await waitForUnisat();
    if (!unisat.getBitcoinUtxos) {
      throw new Error("WALLET UTXO UNAVAILABLE");
    }
    const list = await unisat.getBitcoinUtxos();
    return list.map((u) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.satoshis ?? u.value ?? 0,
    }));
  },

  async disconnect() {
    // Unisat has no standard disconnect — UI clears local state
  },
};

export function detectWallet(): WalletAdapter | null {
  if (typeof window === "undefined") return null;
  if (window.unisat || unisatAdapter.isAvailable()) return unisatAdapter;
  return null;
}
