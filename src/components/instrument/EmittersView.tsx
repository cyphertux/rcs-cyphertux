"use client";

import { BITCOIN_CONFIG } from "@/bitcoin/config";
import { formatDateShort, truncateTxid } from "@/domain/format";
import { aggregateEmitters } from "@/domain/memory";
import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import {
  LcdBox,
  LcdList,
  LcdListItem,
  LcdPanel,
  LcdRow,
} from "./LcdPanel";
import styles from "./LcdPanel.module.css";

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export function EmittersView() {
  const { t } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const memory = useMachineStore((s) => s.memory);
  const emitters = aggregateEmitters(memory);

  if (!flow || flow.kind !== "emitters") {
    return (
      <LcdPanel title={t("emit.title")} hint={t("emit.loadingHint")}>
        <p className={styles.line}>{t("emit.loading")}</p>
      </LcdPanel>
    );
  }

  if (flow.step === "detail" && flow.selectedAddress) {
    const addr = flow.selectedAddress;
    const entries = memory
      .filter((m) => m.fromAddress === addr)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const addrUrl = `${BITCOIN_CONFIG.mempoolAddressBase}${addr}`;

    return (
      <LcdPanel
        title={t("emit.title")}
        meta={t("emit.metaCount", { n: entries.length })}
        hint={t("emit.hintDetail")}
      >
        <LcdBox>
          <p className={styles.line}>{addr}</p>
        </LcdBox>
        <p className={styles.line}>
          <a
            className={styles.extLink}
            href={addrUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("emit.viewMempool")}
          </a>
        </p>
        <LcdRow label={t("label.messages")} value={String(entries.length)} />
        {entries.length === 0 ? (
          <p className={styles.line}>{t("emit.noMsgs")}</p>
        ) : (
          <LcdList>
            {entries.slice(0, 8).map((e) => (
              <LcdListItem
                key={e.txid}
                code={`#${e.id}`}
                desc={`${formatDateShort(e.createdAt)} · ${truncateTxid(e.txid, 4)}`}
              />
            ))}
          </LcdList>
        )}
      </LcdPanel>
    );
  }

  return (
    <LcdPanel
      title={t("emit.title")}
      meta={
        emitters.length === 0
          ? t("emit.metaEmpty")
          : t("emit.metaOps", { n: emitters.length })
      }
      hint={
        emitters.length > 0
          ? t("emit.hintList", { n: emitters.length })
          : t("emit.hintEmpty")
      }
    >
      {emitters.length === 0 ? (
        <p className={styles.line}>{t("emit.empty")}</p>
      ) : (
        <LcdList>
          {emitters.map((e, i) => (
            <LcdListItem
              key={e.address}
              code={String(i + 1).padStart(2, "0")}
              desc={`${shortAddr(e.address)} · ${e.count} MSG`}
            />
          ))}
        </LcdList>
      )}
    </LcdPanel>
  );
}
