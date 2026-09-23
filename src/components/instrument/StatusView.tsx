"use client";

import { DUST_SATS } from "@/bitcoin/config";
import { formatSats } from "@/domain/format";
import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import { LcdHero, LcdPanel, LcdRow } from "./LcdPanel";

export function StatusView() {
  const { t, locale } = useLocale();
  const status = useMachineStore((s) => s.status);
  const numLocale = locale === "en" ? "en-US" : "fr-FR";

  return (
    <LcdPanel
      title={t("status.title")}
      meta={status.networkLabel}
      hint={t("status.hint")}
    >
      <LcdHero sub={t("status.heroSub")}>
        {status.blockHeight || "--------"}
      </LcdHero>

      <LcdRow label={t("label.channel")} value={status.channel} />
      <LcdRow
        label={t("label.node")}
        value={status.nodeStatus}
        tone={
          status.nodeStatus === "ONLINE"
            ? "ok"
            : status.nodeStatus === "OFFLINE"
              ? "bad"
              : "warn"
        }
      />
      {status.nodeStatus === "OFFLINE" ? (
        <LcdRow
          label={t("label.alert")}
          value={t("status.alertMute")}
          tone="bad"
        />
      ) : null}
      {status.nodeStatus === "DEGRADED" ? (
        <LcdRow
          label={t("label.alert")}
          value={t("status.alertWeak")}
          tone="warn"
        />
      ) : null}
      <LcdRow
        label={t("label.probe")}
        value={
          status.lastProbeAt > 0
            ? t("status.ago", {
                n: Math.max(
                  0,
                  Math.floor((Date.now() - status.lastProbeAt) / 1000),
                ),
              })
            : "—"
        }
      />
      <LcdRow
        label={t("label.memory")}
        value={String(status.memoryCount).padStart(3, "0")}
      />
      <LcdRow
        label={t("label.emitters")}
        value={String(status.emitterCount ?? 0).padStart(3, "0")}
      />
      <LcdRow
        label={t("label.feeNext")}
        value={
          status.nextFeeSatVb > 0
            ? `${status.nextFeeSatVb} [${status.nextFeeMin}–${status.nextFeeMax}]`
            : "—"
        }
      />
      <LcdRow
        label={t("label.blockNext")}
        value={
          status.nextBlockTx > 0
            ? `${status.nextBlockTx} TX · ${Math.round(status.mempoolFill * 100)}%`
            : `${Math.round(status.mempoolFill * 100)}%`
        }
      />
      <LcdRow
        label={t("label.feesNext")}
        value={
          status.nextTotalFees > 0
            ? `${status.nextTotalFees.toLocaleString(numLocale)} SAT`
            : "—"
        }
      />
      <LcdRow
        label={t("label.relay")}
        value={
          status.feeRateSatVb > 0 ? `${status.feeRateSatVb} SAT/VB` : "—"
        }
      />
      <LcdRow label={t("label.mempool")} value={`${status.queueSize} TX`} />
      <LcdRow
        label={t("label.tipAge")}
        value={status.tipAgeSec > 0 ? `${status.tipAgeSec}s` : "—"}
      />
      <LcdRow label={t("label.time")} value={status.time} />
      <LcdRow label={t("label.dust")} value={formatSats(DUST_SATS)} />
    </LcdPanel>
  );
}
