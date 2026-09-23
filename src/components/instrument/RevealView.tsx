"use client";

import type { ReactNode } from "react";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import { formatSats, truncateTxid } from "@/domain/format";
import type { RevealFlow } from "@/domain/types";
import { listPendingSeals } from "@/storage/local";
import { useLocale } from "@/locale";
import { SignalPath } from "./SignalPath";
import { useMachineStore } from "@/state/machineStore";
import {
  LcdBox,
  LcdHero,
  LcdList,
  LcdListItem,
  LcdPanel,
  LcdRow,
} from "./LcdPanel";
import styles from "./LcdPanel.module.css";
import css from "./TransmitView.module.css";

export function RevealView() {
  const { t } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const reducedMotion = useMachineStore((s) => s.reducedMotion);

  if (!flow || flow.kind !== "reveal") {
    return (
      <LcdPanel title={t("reveal.title")} hint={t("reveal.loadingHint")}>
        <p className={styles.line}>{t("reveal.loading")}</p>
      </LcdPanel>
    );
  }

  const rf = flow as RevealFlow;
  const pending = listPendingSeals().filter((s) => !s.revealed);
  const tip = rf.tip ?? 0;

  const hint =
    rf.step === "list"
      ? t("reveal.hintList", { n: pending.length || 1 })
      : rf.step === "locked"
        ? t("reveal.hintLocked")
        : rf.step === "confirm"
          ? t("reveal.hintConfirm")
          : t("reveal.hintEsc");

  return (
    <LcdPanel title={t("reveal.title")} meta="RCS/02" hint={hint}>
      {rf.step === "list" && (
        <>
          <LcdRow label={t("label.tip")} value={`H ${tip || "—"}`} />
          {pending.length === 0 ? (
            <p className={styles.line}>{t("reveal.empty")}</p>
          ) : (
            <LcdList>
              {pending.map((s, i) => {
                const ready = tip >= s.lockHeight;
                return (
                  <LcdListItem
                    key={s.sealTxid}
                    code={String(i + 1).padStart(2, "0")}
                    desc={`${ready ? t("reveal.ready") : t("reveal.wait")} · H${s.lockHeight} · ${formatSats(s.sats)}`}
                  />
                );
              })}
            </LcdList>
          )}
        </>
      )}

      {rf.step === "locked" && (
        <LcdBox>
          <p className={styles.line}>
            {t("reveal.lockedLine", {
              lock: rf.lockHeight ?? "—",
              tip: tip || "—",
            })}
          </p>
          <LcdRow
            label={t("label.tx")}
            value={truncateTxid(rf.sealTxid ?? "", 6)}
          />
          <p className={styles.line}>{t("reveal.lockedHint")}</p>
        </LcdBox>
      )}

      {rf.step === "confirm" && (
        <>
          <LcdHero sub={`« ${rf.message} »`}>
            {formatSats(rf.sats ?? 0)}
          </LcdHero>
          <LcdRow label={t("label.ritual")} value={formatSats(rf.sats ?? 0)} />
          <LcdRow
            label={t("label.onchain")}
            value={formatSats(rf.anchorSats ?? rf.sats ?? 0)}
          />
          <LcdRow
            label={t("label.unlock")}
            value={`H ${rf.lockHeight ?? "—"}`}
          />
          <LcdRow label={t("label.miner")} value={formatSats(rf.feeSats ?? 0)} />
          <LcdRow
            label={t("label.total")}
            value={formatSats(rf.totalSats ?? 0)}
            tone="ok"
          />
          <p className={styles.line}>{t("reveal.ritualNote")}</p>
          {rf.signHints?.tapInputIndexes?.length ? (
            <p className={styles.line}>{t("reveal.tapNote")}</p>
          ) : (
            <p className={styles.line}>{t("reveal.softNote")}</p>
          )}
          <LcdBox>
            <p className={styles.line}>{t("reveal.confirm")}</p>
          </LcdBox>
        </>
      )}

      {rf.step === "signing" && (
        <LcdBox>
          <p className={styles.line}>{t("reveal.waitSign")}</p>
          <p className={css.costLine}>{t("tx.approve")}</p>
        </LcdBox>
      )}

      {(rf.step === "signal" ||
        rf.step === "broadcast" ||
        rf.step === "confirmed") && (
        <>
          <LcdHero sub={rf.message ? `« ${rf.message} »` : undefined}>
            {formatSats(rf.sats ?? 0)}
          </LcdHero>
          <div className={css.stages}>
            <Stage active={rf.step === "signal"} done={rf.step !== "signal"}>
              {t("tx.encode")}
            </Stage>
            <span className={css.arrow}>↓</span>
            <Stage
              active={rf.step === "broadcast"}
              done={rf.step === "confirmed"}
            >
              {t("tx.broadcast")}
            </Stage>
            <span className={css.arrow}>↓</span>
            <Stage active={rf.step === "confirmed"} done={false}>
              {t("reveal.open")}
            </Stage>
          </div>
          {rf.step === "confirmed" ? (
            <LcdBox>
              <SignalPath
                stage="confirmed"
                sats={rf.sats ?? 0}
                reducedMotion={reducedMotion}
              />
              <p className={styles.line}>{t("reveal.written")}</p>
              {rf.txid ? (
                <p className={styles.line}>
                  {BITCOIN_CONFIG.mempoolTxBase}
                  {rf.txid.slice(0, 12)}…
                </p>
              ) : null}
              <p className={css.dimLine}>{t("line.utxoIndex")}</p>
            </LcdBox>
          ) : (
            <SignalPath
              stage={rf.step === "signal" ? "signal" : "broadcast"}
              sats={rf.sats ?? 0}
              reducedMotion={reducedMotion}
            />
          )}
        </>
      )}

      {rf.step === "cancelled" && (
        <LcdBox>
          <p className={styles.line}>{t("reveal.cancelled")}</p>
        </LcdBox>
      )}

      {rf.step === "failed" && (
        <LcdBox>
          <p className={styles.line}>{t("reveal.failed")}</p>
          {rf.error ? <p className={styles.line}>{rf.error}</p> : null}
          <p className={styles.line}>{t("tx.failedHint")}</p>
        </LcdBox>
      )}
    </LcdPanel>
  );
}

function Stage({
  children,
  active,
  done,
}: {
  children: ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={[
        css.stage,
        active ? css.stageActive : "",
        done ? css.stageDone : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
