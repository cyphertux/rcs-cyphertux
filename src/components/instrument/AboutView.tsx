"use client";

import { BITCOIN_CONFIG, DUST_SATS, PROTOCOL_VERSION } from "@/bitcoin/config";
import { useLocale } from "@/locale";
import { LcdBox, LcdLines, LcdPanel, LcdRow } from "./LcdPanel";

export function AboutView() {
  const { t } = useLocale();

  return (
    <LcdPanel
      title={t("about.title")}
      meta={PROTOCOL_VERSION}
      hint={t("about.hint")}
    >
      <LcdBox>
        <LcdLines lines={[t("about.l1"), t("about.l2"), t("about.l3")]} />
      </LcdBox>

      <LcdRow
        label={t("label.source")}
        value={t("about.source")}
        href="https://github.com/cyphertux/rcs-cyphertux"
      />
      <LcdRow label={t("label.protocol")} value={PROTOCOL_VERSION} />
      <LcdRow label={t("label.network")} value={BITCOIN_CONFIG.networkDisplayName} />
      <LcdRow label={t("label.channel")} value={BITCOIN_CONFIG.defaultChannel} />
      <LcdRow label={t("label.dust")} value={`${DUST_SATS} SAT`} />
      <LcdRow label={t("label.sink")} value={shortAddr(BITCOIN_CONFIG.protocolSink)} />
      <LcdRow label={t("label.index")} value={t("about.index")} />
      <LcdRow label={t("label.sign")} value={t("about.sign")} />
      <LcdRow label={t("label.keys")} value={t("about.keys")} />
    </LcdPanel>
  );
}

function shortAddr(addr: string): string {
  if (addr.length < 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
