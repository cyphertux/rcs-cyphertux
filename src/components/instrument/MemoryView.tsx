"use client";

import { useEffect, useState } from "react";
import { BITCOIN_CONFIG } from "@/bitcoin/config";
import {
  formatDateLong,
  formatDateShort,
  formatSats,
  truncateTxid,
} from "@/domain/format";
import type { MemoryEntry } from "@/domain/memory";
import {
  clearLastTransmission,
  getLastTransmission,
  type LastTransmission,
} from "@/storage/local";
import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import { LcdBox, LcdList, LcdListItem, LcdPanel, LcdRow } from "./LcdPanel";
import styles from "./LcdPanel.module.css";

const MUSEUM_MAX = 3;

function kindGlyph(kind: MemoryEntry["kind"]): string {
  if (kind === "sealed") return "▣";
  if (kind === "revealed") return "◇";
  return "◆";
}

function kindLabel(
  kind: MemoryEntry["kind"],
  t: (key: "mem.kindOpen" | "mem.kindSealed" | "mem.kindRevealed") => string,
): string {
  if (kind === "sealed") return t("mem.kindSealed");
  if (kind === "revealed") return t("mem.kindRevealed");
  return t("mem.kindOpen");
}

function listDesc(
  e: MemoryEntry,
  t: (key: "mem.kindOpen" | "mem.kindSealed" | "mem.kindRevealed") => string,
): string {
  return `${kindGlyph(e.kind)} #${e.id} · ${kindLabel(e.kind, t)} · ${formatDateShort(e.createdAt)} · ${formatSats(e.sats)}`;
}

function MempoolLink({
  txid,
  label,
}: {
  txid: string;
  label: string;
}) {
  return (
    <p className={styles.line}>
      <a
        className={styles.extLink}
        href={`${BITCOIN_CONFIG.mempoolTxBase}${txid}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    </p>
  );
}

export function MemoryView() {
  const { t } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const memory = useMachineStore((s) => s.memory);
  const [lastLocal, setLastLocal] = useState<LastTransmission | null>(null);

  useEffect(() => {
    const last = getLastTransmission();
    if (!last) {
      setLastLocal(null);
      return;
    }
    if (memory.some((m) => m.txid === last.txid)) {
      clearLastTransmission();
      setLastLocal(null);
      return;
    }
    setLastLocal(last);
  }, [memory]);

  if (!flow || flow.kind !== "memory") {
    return (
      <LcdPanel title={t("mem.title")} meta="…" hint={t("mem.loadingHint")}>
        <p className={styles.line}>{t("mem.loading")}</p>
      </LcdPanel>
    );
  }

  if (flow.step === "detail" && flow.selectedId) {
    const entry = memory.find((m) => m.id === flow.selectedId);
    if (!entry) {
      return (
        <LcdPanel title={t("mem.title")} hint="ESC">
          <p className={styles.line}>{t("mem.missing")}</p>
        </LcdPanel>
      );
    }
    return <MemoryDetail entry={entry} />;
  }

  const sorted = [...memory].sort((a, b) => b.id.localeCompare(a.id));
  const museum = sorted.length > 0 && sorted.length <= MUSEUM_MAX;

  return (
    <LcdPanel
      title={t("mem.title")}
      meta={
        memory.length === 0
          ? t("mem.metaEmpty")
          : museum
            ? t("mem.metaMuseum")
            : t("mem.metaCount", { n: memory.length })
      }
      hint={
        sorted.length > 0
          ? t("mem.hintSelect", { n: sorted.length })
          : t("mem.hintEmpty")
      }
    >
      {lastLocal ? (
        <LcdBox>
          <p className={styles.line}>{t("mem.lastLocal")}</p>
          <p className={styles.line}>&quot;{lastLocal.message}&quot;</p>
          <LcdRow label={t("label.value")} value={formatSats(lastLocal.sats)} />
          <LcdRow label={t("label.status")} value={t("mem.pending")} />
          <LcdRow label={t("label.tx")} value={truncateTxid(lastLocal.txid, 6)} />
          <MempoolLink txid={lastLocal.txid} label={t("mem.viewMempool")} />
        </LcdBox>
      ) : null}

      {sorted.length === 0 && !lastLocal ? (
        <p className={styles.line}>{t("mem.empty")}</p>
      ) : museum ? (
        <div className={styles.lines}>
          {sorted.map((e) => (
            <LcdBox key={e.txid}>
              <p className={styles.line}>
                {kindGlyph(e.kind)} #{e.id} · {kindLabel(e.kind, t)}
              </p>
              <p className={styles.line}>&quot;{e.message}&quot;</p>
              <p className={styles.line}>
                {formatDateLong(e.createdAt)} · {formatSats(e.sats)} · CH{" "}
                {e.channel}
              </p>
              <MempoolLink txid={e.txid} label={t("mem.viewMempool")} />
            </LcdBox>
          ))}
        </div>
      ) : (
        <LcdList>
          {sorted.map((e, i) => (
            <LcdListItem
              key={e.txid}
              code={String(i + 1).padStart(2, "0")}
              desc={listDesc(e, t)}
            />
          ))}
        </LcdList>
      )}
    </LcdPanel>
  );
}

function MemoryDetail({ entry }: { entry: MemoryEntry }) {
  const { t } = useLocale();

  return (
    <LcdPanel
      title={t("mem.title")}
      meta={`#${entry.id}`}
      hint={t("mem.detailHint")}
    >
      <LcdBox>
        <p className={styles.line}>&quot;{entry.message}&quot;</p>
      </LcdBox>
      <MempoolLink txid={entry.txid} label={t("mem.viewMempool")} />
      {entry.revealTxid ? (
        <MempoolLink txid={entry.revealTxid} label={t("mem.viewReveal")} />
      ) : null}
      <LcdRow label={t("label.status")} value={kindLabel(entry.kind, t)} />
      <LcdRow label={t("label.date")} value={formatDateLong(entry.createdAt)} />
      <LcdRow label={t("label.channel")} value={entry.channel} />
      <LcdRow label={t("label.value")} value={formatSats(entry.sats)} />
      <LcdRow
        label={t("label.block")}
        value={entry.blockHeight != null ? String(entry.blockHeight) : "—"}
      />
      {entry.unlockHeight != null ? (
        <LcdRow
          label={t("label.revealAt")}
          value={t("seal.revealAtH", { h: entry.unlockHeight })}
        />
      ) : null}
      <LcdRow label={t("label.tx")} value={truncateTxid(entry.txid, 6)} />
      {entry.fromAddress ? (
        <LcdRow
          label={t("label.emitters")}
          value={`${entry.fromAddress.slice(0, 8)}…${entry.fromAddress.slice(-4)}`}
        />
      ) : null}
      <LcdRow label={t("label.proto")} value={entry.protocolVersion} />
      {entry.fromAddress ? (
        <p className={styles.line}>
          <a
            className={styles.extLink}
            href={`${BITCOIN_CONFIG.mempoolAddressBase}${entry.fromAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("emit.viewMempool")}
          </a>
        </p>
      ) : null}
    </LcdPanel>
  );
}
