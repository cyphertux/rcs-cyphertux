"use client";

import { useEffect, useMemo } from "react";
import {
  BITCOIN_CONFIG,
  DUST_SATS,
  PROTOCOL_VERSION,
} from "@/bitcoin/config";
import { formatSats } from "@/domain/format";
import type { MemoryEntry } from "@/domain/memory";
import { defaultMenuIndex, getSommaireAnnotated } from "@/domain/menu";
import { runMenuCommand } from "@/domain/menuRunner";
import { useLocale } from "@/locale";
import type { MessageKey } from "@/locale/core";
import {
  getQuickStartSeen,
  listPendingSeals,
  setQuickStartSeen,
} from "@/storage/local";
import { useWallet } from "@/wallet/WalletContext";
import { useMachineStore } from "@/state/machineStore";
import { AboutView } from "./AboutView";
import { CalendarView } from "./CalendarView";
import { DebugView } from "./DebugView";
import { HelpView } from "./HelpView";
import { InstrumentInput } from "./InstrumentInput";
import { LinkView } from "./LinkView";
import { EmittersView } from "./EmittersView";
import { MemoryView } from "./MemoryView";
import { NetworkView } from "./NetworkView";
import { OfflineView } from "./OfflineView";
import { StatusView } from "./StatusView";
import { TransmitView } from "./TransmitView";
import { SealView } from "./SealView";
import { RevealView } from "./RevealView";
import { TutorialView } from "./TutorialView";
import styles from "./TelegbFrame.module.css";

type OpPhase = "link" | "fund" | "ready";

type TFn = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

function clipMsg(msg: string, max = 36): string {
  const clean = msg.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function shortWallet(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function compactSats(n: number): string {
  return `${n}s`;
}

function buildTickerItems(
  memory: MemoryEntry[],
  tip: number,
  t: TFn,
): string[] {
  const parts: string[] = [];
  const seenReveal = new Set<number>();

  const upcoming = memory
    .filter(
      (m) =>
        m.kind === "sealed" &&
        m.unlockHeight != null &&
        m.unlockHeight > tip,
    )
    .sort((a, b) => (a.unlockHeight ?? 0) - (b.unlockHeight ?? 0))
    .slice(0, 3);

  for (const u of upcoming) {
    const h = u.unlockHeight!;
    seenReveal.add(h);
    parts.push(t("frame.tickReveal", { h, n: h - tip }));
  }

  for (const s of listPendingSeals().filter((p) => !p.revealed).slice(0, 3)) {
    if (seenReveal.has(s.lockHeight)) continue;
    if (s.lockHeight > tip) {
      parts.push(
        t("frame.tickReveal", { h: s.lockHeight, n: s.lockHeight - tip }),
      );
    } else {
      parts.push(t("frame.tickRevealReady", { h: s.lockHeight }));
    }
  }

  const msgs = memory
    .filter((m) => m.kind === "open" || m.kind === "revealed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  for (const m of msgs) {
    if (!m.message || m.message.includes("█")) continue;
    parts.push(t("frame.tickMsg", { msg: clipMsg(m.message) }));
  }

  if (parts.length === 0) {
    parts.push(
      t("frame.tickIdle", {
        net: BITCOIN_CONFIG.networkDisplayName,
        proto: PROTOCOL_VERSION,
      }),
    );
  }

  return parts;
}

function WinTicker() {
  const { t } = useLocale();
  const memory = useMachineStore((s) => s.memory);
  const tip = useMachineStore((s) => s.status.blockHeight);
  const reducedMotion = useMachineStore((s) => s.reducedMotion);
  const items = useMemo(
    () => buildTickerItems(memory, tip, t),
    [memory, tip, t],
  );
  const sep = t("frame.tickSep");
  const line = items.join(sep);

  return (
    <div className={styles.ticker} tabIndex={0} aria-live="off">
      <div
        className={
          reducedMotion ? styles.tickerTrackStatic : styles.tickerTrack
        }
      >
        <span>{line}</span>
        {!reducedMotion ? (
          <span aria-hidden>
            {sep}
            {line}
          </span>
        ) : null}
      </div>
    </div>
  );
}
const STAGE_KEY: Record<string, MessageKey> = {
  help: "stage.help",
  tutorial: "stage.tutorial",
  status: "stage.status",
  about: "stage.about",
  debug: "stage.debug",
  link: "stage.link",
  network: "stage.network",
  transmit: "stage.transmit",
  seal: "stage.seal",
  reveal: "stage.reveal",
  memory: "stage.memory",
  emitters: "stage.emitters",
  calendar: "stage.calendar",
  idle: "stage.idle",
  error: "stage.error",
};

function opPhase(connected: boolean, balance: number): OpPhase {
  if (!connected) return "link";
  if (balance < DUST_SATS) return "fund";
  return "ready";
}

function walletMeta(
  phase: OpPhase,
  address: string | null,
  balanceSats: number,
  t: TFn,
): string {
  if (phase === "link" || !address) return t("frame.walletOff");
  return `${shortWallet(address)} ${compactSats(balanceSats)}`;
}

/** Full-screen DMG LCD — fixed viewport, arrow+enter sommaire */
export function TelegbFrame() {
  const { t, locale, setLocale } = useLocale();
  const visualMode = useMachineStore((s) => s.visualMode);
  const status = useMachineStore((s) => s.status);
  const menuIndex = useMachineStore((s) => s.menuIndex);
  const setMenuIndex = useMachineStore((s) => s.setMenuIndex);
  const appendLine = useMachineStore((s) => s.appendLine);
  const wallet = useWallet();
  const offline = status.nodeStatus === "OFFLINE";
  const showOfflineStage =
    offline && (visualMode === "idle" || visualMode === "error");
  const fee = status.nextFeeSatVb || status.feeRateSatVb;
  const phase = opPhase(wallet.connected, wallet.balanceSats);
  const showMenu = visualMode === "idle" || visualMode === "error";
  const showStage = showOfflineStage || !showMenu;

  const pending = listPendingSeals().filter((p) => !p.revealed);
  const pendingReady = pending.filter(
    (p) => status.blockHeight >= p.lockHeight,
  ).length;

  const sommaire = getSommaireAnnotated(locale, {
    tip: status.blockHeight,
    pendingReady,
    connected: wallet.connected,
    balanceSats: wallet.balanceSats,
    memoryCount: status.memoryCount,
  });

  useEffect(() => {
    if (!showMenu || showOfflineStage) return;
    setMenuIndex(defaultMenuIndex(phase));
  }, [phase, setMenuIndex, showMenu, showOfflineStage]);

  useEffect(() => {
    if (!showMenu || showOfflineStage) return;
    if (getQuickStartSeen()) return;
    appendLine({ kind: "bright", text: t("frame.quickStart") });
    setQuickStartSeen();
    setMenuIndex(defaultMenuIndex("link"));
  }, [appendLine, setMenuIndex, showMenu, showOfflineStage, t]);

  const stageLabel =
    STAGE_KEY[visualMode] != null
      ? t(STAGE_KEY[visualMode])
      : visualMode.toUpperCase();

  const walletLine = walletMeta(
    phase,
    wallet.address,
    wallet.balanceSats,
    t,
  );

  return (
    <div
      className={styles.screen}
      data-telegb-frame
      data-health={status.nodeStatus}
      lang={locale}
    >
      <div className={styles.dotMatrix} aria-hidden />

      <header className={styles.head}>
        <span>3615 RCS</span>
        <span className={styles.blink}>
          {offline
            ? t("frame.noLink")
            : status.nodeStatus === "DEGRADED"
              ? t("frame.weak")
              : t("frame.online")}
        </span>
        <span className={styles.headMeta}>
          H:{status.blockHeight || "----"} · M:
          {String(status.memoryCount).padStart(3, "0")} · F:{fee || "--"} ·{" "}
          <span
            key={wallet.connected ? wallet.balanceSats : "off"}
            className={styles.walletPulse}
            data-bal={wallet.connected ? wallet.balanceSats : "off"}
          >
            {walletLine}
          </span>
        </span>
        <span>{status.time}</span>
        <button
          type="button"
          className={styles.langBtn}
          title="FR / EN"
          onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
        >
          {locale.toUpperCase()}
        </button>
        <span className={styles.escHint}>{t("frame.escHint")}</span>
      </header>

      <div className={styles.win}>
        <span className={styles.winTitle}>SERVICE 07</span>
        <span className={styles.big}>
          <svg
            className={styles.btcMark}
            viewBox="0 0 16 16"
            shapeRendering="crispEdges"
            aria-hidden
          >
            {/* Filled disc */}
            <g fill="currentColor">
              <rect x="5" y="1" width="6" height="1" />
              <rect x="3" y="2" width="10" height="1" />
              <rect x="2" y="3" width="12" height="1" />
              <rect x="1" y="4" width="14" height="8" />
              <rect x="2" y="12" width="12" height="1" />
              <rect x="3" y="13" width="10" height="1" />
              <rect x="5" y="14" width="6" height="1" />
            </g>
            {/* ₿ cutout — || stem + two closed bowls */}
            <g fill="var(--btc-void)">
              <rect x="6" y="2" width="1" height="11" />
              <rect x="8" y="2" width="1" height="11" />
              <rect x="5" y="4" width="6" height="1" />
              <rect x="10" y="5" width="1" height="2" />
              <rect x="5" y="7" width="6" height="1" />
              <rect x="10" y="8" width="1" height="2" />
              <rect x="5" y="10" width="6" height="1" />
            </g>
          </svg>
          RCS
        </span>
        <WinTicker />
      </div>

      <div className={styles.body}>
        {showOfflineStage ? (
          <section className={styles.stage} aria-live="assertive">
            <div className={styles.stageHead}>
              {t("frame.stageEsc", { stage: t("stage.offline") })}
            </div>
            <div className={styles.stageScroll}>
              <OfflineView />
            </div>
          </section>
        ) : null}

        {showMenu && !showOfflineStage ? (
          <nav className={styles.menu} aria-label={t("frame.sommaire")}>
            <p className={styles.menuLabel}>{t("frame.sommaire")}</p>
            <ul className={styles.menuList}>
              {sommaire.map((item, i) => (
                <li
                  key={item.code}
                  data-cursor={i === menuIndex ? "1" : "0"}
                  data-dim={item.dim ? "1" : "0"}
                >
                  <button
                    type="button"
                    className={styles.menuBtn}
                    onClick={() => {
                      setMenuIndex(i);
                      runMenuCommand(item.code);
                    }}
                    onMouseEnter={() => setMenuIndex(i)}
                  >
                    <span className={styles.cursor} aria-hidden>
                      {i === menuIndex ? "▶" : " "}
                    </span>
                    <span className={item.dim ? styles.menuNameDim : undefined}>
                      {item.label}
                    </span>
                    <span className={styles.menuCode}>
                      {item.code}
                      {item.note ? (
                        <span className={styles.menuNote}>{item.note}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.credit}>
              {phase === "ready"
                ? t("frame.creditReady", {
                    sats: formatSats(wallet.balanceSats),
                  })
                : phase === "fund"
                  ? t("frame.creditFund", { sats: formatSats(DUST_SATS) })
                  : t("frame.creditLink")}
            </p>
          </nav>
        ) : null}

        {showStage && !showOfflineStage ? (
          <section className={styles.stage} aria-live="polite">
            <div className={styles.stageHead}>
              {t("frame.stageEsc", { stage: stageLabel })}
            </div>
            <div className={styles.stageScroll}>
              {visualMode === "help" ? <HelpView /> : null}
              {visualMode === "tutorial" ? <TutorialView /> : null}
              {visualMode === "status" ? <StatusView /> : null}
              {visualMode === "about" ? <AboutView /> : null}
              {visualMode === "debug" ? <DebugView /> : null}
              {visualMode === "link" ? <LinkView /> : null}
              {visualMode === "network" ? <NetworkView /> : null}
              {visualMode === "transmit" ? <TransmitView /> : null}
              {visualMode === "seal" ? <SealView /> : null}
              {visualMode === "reveal" ? <RevealView /> : null}
              {visualMode === "memory" ? <MemoryView /> : null}
              {visualMode === "emitters" ? <EmittersView /> : null}
              {visualMode === "calendar" ? <CalendarView /> : null}
            </div>
          </section>
        ) : null}
      </div>

      <footer className={styles.saisie}>
        <span className={styles.saisieTag}>▶</span>
        <div className={styles.saisieField}>
          <InstrumentInput />
        </div>
      </footer>
    </div>
  );
}
