"use client";

import { useState } from "react";
import { formatSats, truncateTxid } from "@/domain/format";
import { runMenuCommand } from "@/domain/menuRunner";
import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import { useWallet } from "@/wallet/WalletContext";
import { LcdPanel, LcdRow } from "./LcdPanel";
import styles from "./OfflineView.module.css";

/** Silence Testnet4 / Esplora — wallet still reachable · fits without scroll */
export function OfflineView() {
  const { t } = useLocale();
  const status = useMachineStore((s) => s.status);
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const tip = status.blockHeight > 0 ? String(status.blockHeight) : "————";

  const onConnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await wallet.connect();
      runMenuCommand("LINK");
    } catch {
      /* error on wallet.error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <LcdPanel
      title={t("offline.title")}
      meta={t("offline.meta")}
      hint={t("offline.hint")}
    >
      <p className={styles.banner}>{t("offline.banner")}</p>
      <p className={styles.sub}>
        {t("offline.lines")}
        {wallet.connected ? ` · ${t("offline.transmitOk")}` : ""}
      </p>

      <LcdRow label={t("offline.node")} value="OFFLINE" tone="bad" />
      <LcdRow label={t("offline.tip")} value={tip} />
      <LcdRow
        label={t("offline.wallet")}
        value={
          wallet.connected
            ? `${t("offline.walletOn")} · ${formatSats(wallet.balanceSats)}`
            : t("offline.walletOff")
        }
        tone={wallet.connected ? "ok" : "warn"}
      />
      {wallet.connected && wallet.address ? (
        <LcdRow
          label={t("offline.addr")}
          value={truncateTxid(wallet.address, 6)}
        />
      ) : null}
      {wallet.error ? (
        <LcdRow label={t("label.error")} value={wallet.error} tone="bad" />
      ) : null}

      <div className={styles.actions}>
        {wallet.connected ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => runMenuCommand("LINK")}
          >
            ▶ LINK
          </button>
        ) : (
          <button
            type="button"
            className={styles.action}
            disabled={busy}
            onClick={() => void onConnect()}
          >
            ▶ {busy ? t("offline.connecting") : "CONNECT"}
          </button>
        )}
      </div>
    </LcdPanel>
  );
}
