"use client";

import { BITCOIN_CONFIG, DUST_SATS } from "@/bitcoin/config";
import { formatSats } from "@/domain/format";
import { FAUCET_PATH, getTutorialSteps } from "@/domain/tutorial";
import { useLocale } from "@/locale";
import { useMachineStore } from "@/state/machineStore";
import { useWallet } from "@/wallet/WalletContext";
import {
  LcdBox,
  LcdLines,
  LcdList,
  LcdListItem,
  LcdPanel,
  LcdRow,
} from "./LcdPanel";
import styles from "./LcdPanel.module.css";

export function TutorialView() {
  const { t, locale } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const wallet = useWallet();
  const steps = getTutorialSteps(locale);
  const step = flow?.kind === "tutorial" ? flow.step : 0;
  const active =
    step >= 1 && step <= steps.length ? steps[step - 1] : null;

  return (
    <LcdPanel
      title={t("tut.title")}
      meta={
        active ? t("tut.metaStep", { n: active.id }) : t("tut.metaMenu")
      }
      hint={
        active
          ? t("tut.hintStep", { action: active.action })
          : t("tut.hintMenu")
      }
    >
      {!active ? (
        <>
          <LcdBox>
            <LcdLines
              lines={[t("tut.lead1"), BITCOIN_CONFIG.networkDisplayName]}
            />
          </LcdBox>
          <LcdList>
            {steps.map((s) => (
              <LcdListItem
                key={s.id}
                code={String(s.id)}
                desc={`${s.title} · ${s.action}`}
              />
            ))}
          </LcdList>
          <LcdRow
            label={t("label.key")}
            value={
              wallet.connected
                ? formatSats(wallet.balanceSats)
                : t("tut.keyAbsent")
            }
            tone={wallet.connected ? "ok" : "warn"}
          />
          <LcdRow label={t("label.dust")} value={formatSats(DUST_SATS)} />
        </>
      ) : (
        <>
          <LcdBox>
            <p className={styles.line}>
              {String(active.id).padStart(2, "0")} · {active.title}
            </p>
          </LcdBox>
          <LcdLines lines={active.lines} />
          {active.id === 3 ? (
            <LcdRow label={t("label.faucet")} value={FAUCET_PATH} />
          ) : null}
          {(active.id === 2 || active.id === 3) && (
            <LcdRow
              label={t("label.link")}
              value={
                wallet.connected
                  ? formatSats(wallet.balanceSats)
                  : t("tut.notYet")
              }
            />
          )}
        </>
      )}
    </LcdPanel>
  );
}
