import { getLocale, t } from "@/locale/core";

export function formatSats(sats: number): string {
  const locale = getLocale() === "en" ? "en-US" : "fr-FR";
  return `${sats.toLocaleString(locale)} SAT`;
}

export function formatBtc(sats: number): string {
  return `${(sats / 100_000_000).toFixed(8)} BTC`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatTime(date = new Date()): string {
  return date.toTimeString().slice(0, 8);
}

export function truncateTxid(txid: string, edge = 4): string {
  if (txid.length <= edge * 2) return txid;
  return `${txid.slice(0, edge)}...${txid.slice(-edge)}`;
}

export function padDots(label: string, value: string, width = 28): string {
  const dots = Math.max(2, width - label.length - value.length);
  return `${label} ${".".repeat(dots)} ${value}`;
}

export function formatTransmissionId(n: number): string {
  return String(n).padStart(6, "0");
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const monthKey = `cal.m${m ?? 1}` as
    | "cal.m1"
    | "cal.m2"
    | "cal.m3"
    | "cal.m4"
    | "cal.m5"
    | "cal.m6"
    | "cal.m7"
    | "cal.m8"
    | "cal.m9"
    | "cal.m10"
    | "cal.m11"
    | "cal.m12";
  return `${String(d).padStart(2, "0")} ${t(monthKey)} ${y}`;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
