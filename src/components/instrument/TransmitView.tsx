"use client";

import type { ReactNode } from "react";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import { formatSats } from "@/domain/format";
import type { TransmitFlow } from "@/domain/types";
import { useLocale } from "@/locale";
import { SignalPath } from "./SignalPath";
import { FlowStepper } from "./FlowStepper";
import { useMachineStore } from "@/state/machineStore";
import { LcdBox, LcdHero, LcdPanel, LcdRow } from "./LcdPanel";
import styles from "./LcdPanel.module.css";
import css from "./TransmitView.module.css";

const STEP_ORDER = ["value", "message", "confirm"] as const;

export function TransmitView() {
  const { t } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const reducedMotion = useMachineStore((s) => s.reducedMotion);

  if (!flow || flow.kind !== "transmit") {
    return (
      <LcdPanel title={t("tx.title")} hint={t("tx.loadingHint")}>
        <p className={styles.line}>{t("tx.loading")}</p>
      </LcdPanel>
    );
  }

  const tf = flow as TransmitFlow;
  const stepIdx = STEP_ORDER.indexOf(
    tf.step as (typeof STEP_ORDER)[number],
  );
  const showStepper = stepIdx >= 0;

  const hint =
    tf.step === "value"
      ? t("tx.hintValue")
      : tf.step === "message"
        ? t("tx.hintMsg")
        : tf.step === "confirm"
          ? t("tx.hintConfirm")
          : tf.step === "failed"
            ? t("tx.failedActions")
            : t("tx.hintEsc");

  return (
    <LcdPanel title={t("tx.title")} meta="TESTNET4" hint={hint}>
      {showStepper ? (
        <FlowStepper
          steps={[
            t("flow.stepValue"),
            t("flow.stepMsg"),
            t("flow.stepConfirm"),
          ]}
          activeIndex={stepIdx}
        />
      ) : null}

      {(tf.step === "value" || tf.step === "message") && (
        <>
          {tf.step === "value" ? (
            <LcdBox>
              <p className={styles.line}>{t("tx.valuePrompt")}</p>
              <p className={css.dimLine}>{t("tx.valueDust")}</p>
            </LcdBox>
          ) : (
            <LcdBox>
              <p className={styles.line}>{t("tx.writeArchive")}</p>
              <p className={styles.line}>{t("tx.thenConfirm")}</p>
            </LcdBox>
          )}
        </>
      )}

      {tf.step === "confirm" && (
        <>
          <LcdHero sub={`« ${tf.message} »`}>{formatSats(tf.sats)}</LcdHero>
          <p className={css.costLine}>
            {t("tx.costLine", {
              total: tf.totalSats ?? 0,
              anchor: tf.anchorSats ?? tf.sats,
              fee: tf.feeSats ?? 0,
            })}
          </p>
          <LcdRow label={t("label.ritual")} value={formatSats(tf.sats)} />
          <LcdRow
            label={t("label.onchain")}
            value={formatSats(tf.anchorSats ?? tf.sats)}
          />
          <LcdRow label={t("label.miner")} value={formatSats(tf.feeSats ?? 0)} />
          <LcdRow
            label={t("label.total")}
            value={formatSats(tf.totalSats ?? 0)}
            tone="ok"
          />
          {(tf.changeSats ?? 0) > 0 ? (
            <LcdRow
              label={t("label.change")}
              value={formatSats(tf.changeSats ?? 0)}
            />
          ) : null}
          {tf.feeRateSatVb != null ? (
            <LcdRow
              label={t("label.feeRate")}
              value={`${tf.feeRateSatVb} SAT/VB`}
            />
          ) : null}
          <p className={styles.line}>{t("tx.totalHint")}</p>
          {(tf.anchorSats ?? 0) > tf.sats ? (
            <p className={styles.line}>{t("tx.dustFloor")}</p>
          ) : null}
          {tf.truncated ? (
            <p className={styles.line}>{t("tx.truncated")}</p>
          ) : null}
          <LcdBox>
            <p className={styles.line}>{t("tx.seal")}</p>
          </LcdBox>
        </>
      )}

      {tf.step === "signing" && (
        <LcdBox>
          <p className={styles.line}>{t("tx.waitSeal")}</p>
          <p className={css.costLine}>{t("tx.approve")}</p>
        </LcdBox>
      )}

      {(tf.step === "signal" ||
        tf.step === "broadcast" ||
        tf.step === "confirmed") && (
        <>
          <LcdHero sub={tf.message ? `« ${tf.message} »` : undefined}>
            {formatSats(tf.sats)}
          </LcdHero>
          <div className={css.stages}>
            <Stage active={tf.step === "signal"} done={tf.step !== "signal"}>
              {t("tx.encode")}
            </Stage>
            <span className={css.arrow}>↓</span>
            <Stage
              active={tf.step === "broadcast"}
              done={tf.step === "confirmed"}
            >
              {t("tx.broadcast")}
            </Stage>
            <span className={css.arrow}>↓</span>
            <Stage active={tf.step === "confirmed"} done={false}>
              {t("tx.archive")}
            </Stage>
          </div>
          {tf.step !== "confirmed" ? (
            <SignalPath
              stage={tf.step === "signal" ? "signal" : "broadcast"}
              sats={tf.sats}
              reducedMotion={reducedMotion}
            />
          ) : (
            <LcdBox>
              <SignalPath
                stage="confirmed"
                sats={tf.sats}
                reducedMotion={reducedMotion}
              />
              <p className={styles.line}>{t("tx.written")}</p>
              {tf.memoryId ? (
                <p className={styles.line}>◆ {tf.memoryId}</p>
              ) : null}
              {tf.txid ? (
                <p className={styles.line}>{tf.txid.slice(0, 22)}…</p>
              ) : null}
              <p className={styles.line}>
                {tf.blockHeight != null
                  ? t("tx.block", { n: tf.blockHeight })
                  : t("tx.waitBlock")}
              </p>
              {tf.txid ? (
                <p className={styles.line}>
                  {BITCOIN_CONFIG.mempoolTxBase}
                  {tf.txid.slice(0, 12)}…
                </p>
              ) : null}
              <p className={css.dimLine}>{t("line.utxoIndex")}</p>
            </LcdBox>
          )}
        </>
      )}

      {tf.step === "cancelled" && (
        <LcdBox>
          <p className={styles.line}>{t("tx.cancelled")}</p>
        </LcdBox>
      )}

      {tf.step === "failed" && (
        <LcdBox>
          <p className={styles.line}>{t("tx.failed")}</p>
          {tf.error ? <p className={styles.line}>{tf.error}</p> : null}
          <p className={css.costLine}>{t("tx.failedActions")}</p>
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
