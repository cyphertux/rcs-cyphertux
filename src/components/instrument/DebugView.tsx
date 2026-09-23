"use client";

import { useEffect, useState } from "react";
import { BITCOIN_CONFIG, PROTOCOL_VERSION } from "@/bitcoin/config";
import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import { LcdPanel, LcdRow } from "./LcdPanel";

type Probe = {
  chainOk: boolean;
  memoryOk: boolean;
  blockHeight: number;
  feeRateSatVb: number;
  memoryCount: number;
  nodeStatus: string;
  error?: string;
  probedAt: string;
};

export function DebugView() {
  const { t } = useLocale();
  const status = useMachineStore((s) => s.status);
  const muted = useMachineStore((s) => s.muted);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      let chainOk = false;
      let memoryOk = false;
      let blockHeight = status.blockHeight;
      let feeRateSatVb = status.feeRateSatVb;
      let memoryCount = status.memoryCount;
      let nodeStatus: string = status.nodeStatus;
      let error: string | undefined;

      try {
        const res = await fetch("/api/chain/status");
        const data = (await res.json()) as {
          blockHeight?: number;
          feeRateSatVb?: number;
          nodeStatus?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        chainOk = true;
        blockHeight = data.blockHeight ?? blockHeight;
        feeRateSatVb = data.feeRateSatVb ?? feeRateSatVb;
        nodeStatus = data.nodeStatus ?? nodeStatus;
      } catch (e) {
        error = e instanceof Error ? e.message : t("debug.failChain");
      }

      try {
        const res = await fetch("/api/memory");
        const data = (await res.json()) as {
          entries?: unknown[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        memoryOk = true;
        memoryCount = data.entries?.length ?? memoryCount;
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("debug.failMem");
        error = error ? `${error} · ${msg}` : msg;
      }

      if (!cancelled) {
        setProbe({
          chainOk,
          memoryOk,
          blockHeight,
          feeRateSatVb,
          memoryCount,
          nodeStatus,
          error,
          probedAt: new Date().toISOString().slice(11, 19),
        });
        setBusy(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    status.blockHeight,
    status.feeRateSatVb,
    status.memoryCount,
    status.nodeStatus,
    t,
  ]);

  const host = BITCOIN_CONFIG.esploraBase.replace(/^https?:\/\//, "");

  return (
    <LcdPanel
      title={t("debug.title")}
      meta={busy ? t("debug.probing") : (probe?.probedAt ?? "—")}
      hint={t("debug.hint")}
    >
      <LcdRow
        label={t("debug.apiChain")}
        value={probe ? (probe.chainOk ? "OK" : "FAIL") : "…"}
        tone={probe ? (probe.chainOk ? "ok" : "bad") : undefined}
      />
      <LcdRow
        label={t("debug.apiMem")}
        value={probe ? (probe.memoryOk ? "OK" : "FAIL") : "…"}
        tone={probe ? (probe.memoryOk ? "ok" : "bad") : undefined}
      />
      <LcdRow label={t("label.node")} value={probe?.nodeStatus ?? status.nodeStatus} />
      <LcdRow
        label="TIP"
        value={String(probe?.blockHeight ?? status.blockHeight)}
      />
      <LcdRow
        label={t("label.feeNext")}
        value={
          status.nextFeeSatVb > 0 ? `${status.nextFeeSatVb} SAT/VB` : "—"
        }
      />
      <LcdRow
        label={t("label.mempool")}
        value={`${status.queueSize} TX · ${Math.round(status.mempoolFill * 100)}%`}
      />
      <LcdRow
        label={t("label.index")}
        value={String(probe?.memoryCount ?? status.memoryCount)}
      />
      <LcdRow label="ESPLORA" value={host} />
      <LcdRow label={t("label.sink")} value={short(BITCOIN_CONFIG.protocolSink)} />
      <LcdRow label={t("label.proto")} value={PROTOCOL_VERSION} />
      <LcdRow label={t("label.audio")} value={muted ? "OFF" : "ON"} />
      <LcdRow
        label={t("label.mode")}
        value={BITCOIN_CONFIG.useMock ? "MOCK" : "LIVE"}
      />
      {probe?.error ? (
        <LcdRow label="ERR" value={probe.error} tone="bad" />
      ) : null}
    </LcdPanel>
  );
}

function short(addr: string): string {
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}
