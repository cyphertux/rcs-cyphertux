"use client";

import { formatSats } from "@/domain/format";
import { useLocale } from "@/locale";
import { useWallet } from "@/wallet/WalletContext";
import { LcdBox, LcdHero, LcdPanel, LcdRow } from "./LcdPanel";

export function LinkView() {
  const { t } = useLocale();
  const wallet = useWallet();

  return (
    <LcdPanel
      title={t("link.title")}
      meta={wallet.connected ? t("link.metaOn") : t("link.metaOff")}
      hint={wallet.connected ? t("link.hintOn") : t("link.hintOff")}
    >
      <LcdHero sub={wallet.connected ? t("link.heroOn") : t("link.heroOff")}>
        {wallet.connected ? t("link.keyOn") : t("link.keyOff")}
      </LcdHero>

      {wallet.connected ? (
        <>
          <LcdRow label={t("label.provider")} value="UNISAT" />
          <LcdRow label={t("label.network")} value="TESTNET4" />
          <LcdRow label={t("label.address")} value={wallet.address ?? "—"} />
          <LcdRow label={t("label.credit")} value={formatSats(wallet.balanceSats)} />
        </>
      ) : (
        <LcdBox>
          <LcdRow label={t("label.provider")} value="UNISAT" />
          <LcdRow label={t("label.action")} value="CONNECT" />
        </LcdBox>
      )}

      {wallet.error ? (
        <LcdRow label={t("label.error")} value={wallet.error} tone="bad" />
      ) : null}
    </LcdPanel>
  );
}
