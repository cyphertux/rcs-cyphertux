"use client";

import type { ReactNode } from "react";
import { UNLOCK_PRESETS } from "@/bitcoin/protocol/rcs02";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import { formatSats } from "@/domain/format";
import type { SealFlow } from "@/domain/types";
import { useLocale } from "@/locale";
import { SignalPath } from "./SignalPath";
import { FlowStepper } from "./FlowStepper";
import { useMachineStore } from "@/state/machineStore";
import { LcdBox, LcdHero, LcdPanel, LcdRow } from "./LcdPanel";
import styles from "./LcdPanel.module.css";
import css from "./TransmitView.module.css";

const STEP_ORDER = ["value", "message", "unlock", "confirm"] as const;

export function SealView() {
  const { t } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const tip = useMachineStore((s) => s.status.blockHeight);
  const reducedMotion = useMachineStore((s) => s.reducedMotion);

  if (!flow || flow.kind !== "seal") {
    return (
      <LcdPanel title={t("seal.title")} hint={t("seal.loadingHint")}>
        <p className={styles.line}>{t("seal.loading")}</p>
      </LcdPanel>
    );
  }

  const sf = flow as SealFlow;
  const delta = sf.unlockDelta ?? UNLOCK_PRESETS[0];
  const stepIdx = STEP_ORDER.indexOf(
    sf.step as (typeof STEP_ORDER)[number],
  );
  const showStepper = stepIdx >= 0;

  const hint =
    sf.step === "value"
      ? t("seal.hintValue")
      : sf.step === "message"
        ? t("seal.hintMsg")
        : sf.step === "unlock"
          ? t("seal.hintUnlock")
          : sf.step === "confirm"
            ? t("seal.hintConfirm")
            : sf.step === "failed"
              ? t("seal.failedActions")
              : t("seal.hintEsc");

  return (
    <LcdPanel title={t("seal.title")} meta="RCS/02" hint={hint}>
      {showStepper ? (
        <FlowStepper
          steps={[
            t("flow.stepValue"),
            t("flow.stepMsg"),
            t("flow.stepUnlock"),
            t("flow.stepConfirm"),
          ]}
          activeIndex={stepIdx}
        />
      ) : null}

      {(sf.step === "value" || sf.step === "message") && (
        <>
          {sf.step === "value" ? (
            <LcdBox>
              <p className={styles.line}>{t("seal.valuePrompt")}</p>
              <p className={css.dimLine}>{t("seal.valueDust")}</p>
            </LcdBox>
          ) : (
            <LcdBox>
              <p className={styles.line}>{t("seal.writeCommit")}</p>
              <p className={styles.line}>{t("seal.thenUnlock")}</p>
            </LcdBox>
          )}
        </>
      )}

      {sf.step === "unlock" && (
        <>
          <LcdHero sub={t("seal.unlockSub")}>+{delta}</LcdHero>
          <div className={css.presets}>
            {UNLOCK_PRESETS.map((p) => (
              <span
                key={p}
                className={delta === p ? css.presetActive : css.preset}
              >
                +{p}
                {p === 144 ? " ·1J" : p === 1008 ? " ·7J" : ""}
              </span>
            ))}
            <span
              className={
                !(UNLOCK_PRESETS as readonly number[]).includes(delta)
                  ? css.presetActive
                  : css.preset
              }
            >
              {t("seal.custom")}
            </span>
          </div>
          <LcdRow label={t("label.waitBlocks")} value={`+${delta}`} />
          <LcdRow
            label={t("label.revealAt")}
            value={
              tip > 0
                ? t("seal.revealAtH", { h: tip + delta })
                : t("seal.revealAtTip")
            }
          />
          <LcdBox>
            <p className={styles.line}>{t("seal.unlockExplain")}</p>
            <p className={styles.line}>{t("seal.unlockHint")}</p>
          </LcdBox>
        </>
      )}

      {sf.step === "confirm" && (
        <>
          <LcdHero sub={`« ${sf.message} »`}>{formatSats(sf.sats)}</LcdHero>
          <p className={css.costLine}>
            {t("seal.costLine", {
              total: sf.totalSats ?? 0,
              anchor: sf.anchorSats ?? sf.lockValue ?? sf.sats,
              fee: sf.feeSats ?? 0,
            })}
          </p>
          <LcdRow
            label={t("label.hash")}
            value={(sf.commitHash ?? "—").slice(0, 12) + "…"}
          />
          <LcdRow
            label={t("label.revealAt")}
            value={
              sf.lockHeight != null
                ? t("seal.revealAtH", { h: sf.lockHeight })
                : "—"
            }
          />
          <LcdRow
            label={t("label.waitBlocks")}
            value={sf.unlockDelta != null ? `+${sf.unlockDelta}` : "—"}
          />
          {sf.lockAddress ? (
            <LcdRow
              label={t("label.tapLock")}
              value={`${sf.lockAddress.slice(0, 10)}…${sf.lockAddress.slice(-4)}`}
            />
          ) : null}
          {sf.lockValue != null ? (
            <LcdRow
              label={t("label.lockSats")}
              value={formatSats(sf.lockValue)}
            />
          ) : null}
          <LcdRow label={t("label.miner")} value={formatSats(sf.feeSats ?? 0)} />
          <LcdRow
            label={t("label.total")}
            value={formatSats(sf.totalSats ?? 0)}
            tone="ok"
          />
          <p className={styles.line}>{t("seal.tapNote")}</p>
          <LcdBox>
            <p className={styles.line}>{t("seal.confirm")}</p>
          </LcdBox>
        </>
      )}

      {sf.step === "signing" && (
        <LcdBox>
          <p className={styles.line}>{t("seal.waitSign")}</p>
          <p className={css.costLine}>{t("tx.approve")}</p>
        </LcdBox>
      )}

      {(sf.step === "signal" ||
        sf.step === "broadcast" ||
        sf.step === "confirmed") && (
        <>
          <LcdHero sub={t("seal.sealed")}>{formatSats(sf.sats)}</LcdHero>
          <div className={css.stages}>
            <Stage active={sf.step === "signal"} done={sf.step !== "signal"}>
              {t("tx.encode")}
            </Stage>
            <span className={css.arrow}>↓</span>
            <Stage
              active={sf.step === "broadcast"}
              done={sf.step === "confirmed"}
            >
              {t("tx.broadcast")}
            </Stage>
            <span className={css.arrow}>↓</span>
            <Stage active={sf.step === "confirmed"} done={false}>
              {t("seal.commit")}
            </Stage>
          </div>
          {sf.step === "confirmed" ? (
            <LcdBox>
              <SignalPath
                stage="confirmed"
                sats={sf.sats}
                reducedMotion={reducedMotion}
              />
              <p className={styles.line}>{t("seal.written")}</p>
              {sf.lockHeight != null ? (
                <p className={styles.line}>
                  {t("seal.unlockAt", { h: sf.lockHeight })}
                </p>
              ) : null}
              {sf.txid ? (
                <p className={styles.line}>
                  {BITCOIN_CONFIG.mempoolTxBase}
                  {sf.txid.slice(0, 12)}…
                </p>
              ) : null}
              <p className={css.dimLine}>{t("line.utxoIndex")}</p>
            </LcdBox>
          ) : (
            <SignalPath
              stage={sf.step === "signal" ? "signal" : "broadcast"}
              sats={sf.sats}
              reducedMotion={reducedMotion}
            />
          )}
        </>
      )}

      {sf.step === "cancelled" && (
        <LcdBox>
          <p className={styles.line}>{t("seal.cancelled")}</p>
        </LcdBox>
      )}

      {sf.step === "failed" && (
        <LcdBox>
          <p className={styles.line}>{t("seal.failed")}</p>
          {sf.error ? <p className={styles.line}>{sf.error}</p> : null}
          <p className={css.costLine}>{t("seal.failedActions")}</p>
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
