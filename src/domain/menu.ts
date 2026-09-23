import { DUST_SATS } from "@/bitcoin/config";
import { getLocale, t, type Locale } from "@/locale/core";
import { listPendingSeals } from "@/storage/local";

/** Sommaire entries — shared by RCS UI + input nav */
export function getSommaire(locale: Locale = getLocale()): {
  label: string;
  code: string;
}[] {
  return [
    { label: t("menu.transmit", undefined, locale), code: "TRANSMIT" },
    { label: t("menu.seal", undefined, locale), code: "SEAL" },
    { label: t("menu.reveal", undefined, locale), code: "REVEAL" },
    { label: t("menu.memory", undefined, locale), code: "MEMORY" },
    { label: t("menu.emitters", undefined, locale), code: "EMITTERS" },
    { label: t("menu.status", undefined, locale), code: "STATUS" },
    { label: t("menu.help", undefined, locale), code: "HELP" },
    { label: t("menu.tutorial", undefined, locale), code: "TUTORIAL" },
    { label: t("menu.connect", undefined, locale), code: "CONNECT" },
    { label: t("menu.calendar", undefined, locale), code: "CALENDAR" },
    { label: t("menu.network", undefined, locale), code: "NETWORK" },
  ];
}

export type SommaireContext = {
  tip: number;
  pendingReady: number;
  connected: boolean;
  balanceSats: number;
  memoryCount: number;
};

export type SommaireItem = {
  label: string;
  code: string;
  note?: string;
  dim?: boolean;
};

/** Annotated sommaire — visual hints only; all items stay selectable */
export function getSommaireAnnotated(
  locale: Locale = getLocale(),
  ctx?: SommaireContext,
): SommaireItem[] {
  const base = getSommaire(locale);
  if (!ctx) return base.map((item) => ({ ...item }));

  const pending = listPendingSeals().filter((s) => !s.revealed);
  const ready = ctx.pendingReady;
  const lowBal = !ctx.connected || ctx.balanceSats < DUST_SATS;

  return base.map((item) => {
    let note: string | undefined;
    let dim = false;

    if (item.code === "TRANSMIT" || item.code === "SEAL") {
      dim = lowBal;
    }
    if (item.code === "REVEAL") {
      dim = pending.length === 0;
      if (ready > 0) {
        note = t("menu.noteReady", { n: ready }, locale);
      }
    }
    if (item.code === "CONNECT" && !ctx.connected) {
      note = t("menu.noteLink", undefined, locale);
    }

    return { ...item, note, dim };
  });
}

/** @deprecated use getSommaire() */
export const SOMMAIRE = getSommaire("fr");

export function defaultMenuIndex(phase: "link" | "fund" | "ready"): number {
  if (phase === "link") return 8; // CONNECT
  if (phase === "fund") return 7; // TUTORIAL
  return 0; // TRANSMIT
}

export function clampMenuIndex(i: number): number {
  const n = getSommaire().length;
  return ((i % n) + n) % n;
}
