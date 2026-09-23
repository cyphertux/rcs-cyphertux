"use client";

import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import { LcdHero, LcdPanel, LcdRow } from "./LcdPanel";

export function NetworkView() {
  const { t } = useLocale();
  const status = useMachineStore((s) => s.status);
  const reveal = useMachineStore((s) => s.networkReveal);
  const offline = status.nodeStatus === "OFFLINE";

  return (
    <LcdPanel
      title={t("net.title")}
      meta={
        offline
          ? t("net.metaOff")
          : reveal === 0
            ? t("net.metaUnknown")
            : status.networkLabel
      }
      hint={
        offline
          ? t("net.hintOff")
          : reveal >= 3
            ? t("net.hintOk")
            : t("net.hintProbe")
      }
    >
      <LcdHero sub="TIP">
        {offline ? "————" : status.blockHeight || "--------"}
      </LcdHero>

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
      <LcdRow
        label={t("label.feeNext")}
        value={
          offline
            ? "—"
            : status.nextFeeSatVb > 0
              ? `${status.nextFeeSatVb} [${status.nextFeeMin}–${status.nextFeeMax}]`
              : "—"
        }
      />
      <LcdRow
        label={t("label.blockNext")}
        value={
          offline
            ? "—"
            : status.nextBlockTx > 0
              ? `${status.nextBlockTx} TX · ${Math.round(status.mempoolFill * 100)}%`
              : `${Math.round(status.mempoolFill * 100)}%`
        }
      />
      <LcdRow
        label={t("label.tipAge")}
        value={
          offline ? "—" : status.tipAgeSec > 0 ? `${status.tipAgeSec}s` : "—"
        }
      />
      <LcdRow
        label={t("label.protocol")}
        value={offline || reveal === 0 ? "····" : "BTC"}
      />
    </LcdPanel>
  );
}
