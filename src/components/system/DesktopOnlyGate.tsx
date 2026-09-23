"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "@/locale";
import styles from "./DesktopOnlyGate.module.css";

function isBlockedClient(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Phones / tablets — Unisat extension is desktop-only for RCS
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // Coarse pointer + narrow viewport (some mobile browsers spoof UA)
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const narrow =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 900px)").matches;
  return coarse && narrow;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mqCoarse = window.matchMedia("(pointer: coarse)");
  const mqNarrow = window.matchMedia("(max-width: 900px)");
  mqCoarse.addEventListener("change", onStoreChange);
  mqNarrow.addEventListener("change", onStoreChange);
  return () => {
    mqCoarse.removeEventListener("change", onStoreChange);
    mqNarrow.removeEventListener("change", onStoreChange);
  };
}

export function useIsMobileBlocked(): boolean {
  return useSyncExternalStore(subscribe, isBlockedClient, () => false);
}

/** Full-screen LCD lock — RCS requires desktop Unisat extension */
export function DesktopOnlyGate() {
  const { t } = useLocale();

  return (
    <div className={styles.screen} role="alert">
      <div className={styles.panel}>
        <header className={styles.head}>
          <span className={styles.title}>■ {t("desktopOnly.title")} ■</span>
          <span className={styles.meta}>{t("desktopOnly.meta")}</span>
        </header>
        <p className={styles.banner}>{t("desktopOnly.banner")}</p>
        <div className={styles.body}>
          <p className={styles.line}>{t("desktopOnly.l1")}</p>
          <p className={styles.line}>{t("desktopOnly.l2")}</p>
          <p className={styles.line}>{t("desktopOnly.l3")}</p>
        </div>
        <p className={styles.url}>rcs.cyphertux.net</p>
        <footer className={styles.hint}>{t("desktopOnly.hint")}</footer>
      </div>
    </div>
  );
}
