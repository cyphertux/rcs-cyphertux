const BOOT_KEY = "rt-boot-seen";
const QUICK_START_KEY = "rt-quick-start-seen";
const MUTE_KEY = "rt-mute";
const MEMORY_CACHE_KEY = "rt-memory-cache";
const LAST_TX_KEY = "rt-last-tx";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getBootSeen(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(BOOT_KEY) === "1";
}

export function setBootSeen(): void {
  if (!canUseStorage()) return;
  localStorage.setItem(BOOT_KEY, "1");
}

export function getQuickStartSeen(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(QUICK_START_KEY) === "1";
}

export function setQuickStartSeen(): void {
  if (!canUseStorage()) return;
  localStorage.setItem(QUICK_START_KEY, "1");
}

export function getMute(): boolean {
  if (!canUseStorage()) return true;
  const v = localStorage.getItem(MUTE_KEY);
  return v === null ? true : v === "1";
}

export function setMute(muted: boolean): void {
  if (!canUseStorage()) return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/** UI-only cache — never source of truth */
export function cacheMemoryJson(json: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(MEMORY_CACHE_KEY, json);
}

export function readMemoryCacheJson(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(MEMORY_CACHE_KEY);
}

export type LastTransmission = {
  txid: string;
  sats: number;
  message: string;
  channel: string;
  at: string;
};

export function saveLastTransmission(tx: LastTransmission): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LAST_TX_KEY, JSON.stringify(tx));
}

export function getLastTransmission(): LastTransmission | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LAST_TX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastTransmission;
  } catch {
    return null;
  }
}

export function clearLastTransmission(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(LAST_TX_KEY);
}

const PENDING_SEALS_KEY = "rt-pending-seals";

export type PendingSeal = {
  sealTxid: string;
  message: string;
  commitHash: string;
  lockHeight: number;
  sats: number;
  channel: string;
  at: string;
  revealed?: boolean;
  revealTxid?: string;
  /** Taproot CLTV lock (present for seals after taproot iteration) */
  lockAddress?: string;
  lockVout?: number;
  lockValue?: number;
  leafScriptHex?: string;
  controlBlockHex?: string;
  outputScriptHex?: string;
  xOnlyPubHex?: string;
  redeemVersion?: number;
};

export function listPendingSeals(): PendingSeal[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(PENDING_SEALS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingSeal[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePendingSeal(seal: PendingSeal): void {
  if (!canUseStorage()) return;
  const list = listPendingSeals().filter((s) => s.sealTxid !== seal.sealTxid);
  list.unshift(seal);
  localStorage.setItem(PENDING_SEALS_KEY, JSON.stringify(list.slice(0, 40)));
}

export function markSealRevealed(sealTxid: string, revealTxid: string): void {
  if (!canUseStorage()) return;
  const list = listPendingSeals().map((s) =>
    s.sealTxid === sealTxid
      ? { ...s, revealed: true, revealTxid }
      : s,
  );
  localStorage.setItem(PENDING_SEALS_KEY, JSON.stringify(list));
}

/** Drop legacy skin preference if present */
export function clearLegacySkin(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem("rt-skin");
}
