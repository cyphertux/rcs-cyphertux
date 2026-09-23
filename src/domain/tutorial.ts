import { getLocale, t, type Locale } from "@/locale/core";

/** Terminal-facing faucet path (no clickable UI — user opens manually) */
export const FAUCET_PATH = "coinfaucet.eu/en/btc-testnet4/";

export type TutorialStepDef = {
  id: number;
  title: string;
  lines: string[];
  /** Suggested command shown in prompt hint */
  action: string;
};

export function getTutorialSteps(locale: Locale = getLocale()): TutorialStepDef[] {
  return [
    {
      id: 1,
      title: t("tut.s1.title", undefined, locale),
      lines: [
        t("tut.s1.l1", undefined, locale),
        t("tut.s1.l2", undefined, locale),
        t("tut.s1.l3", undefined, locale),
        t("tut.s1.l4", undefined, locale),
      ],
      action: "N",
    },
    {
      id: 2,
      title: t("tut.s2.title", undefined, locale),
      lines: [
        t("tut.s2.l1", undefined, locale),
        t("tut.s2.l2", undefined, locale),
        t("tut.s2.l3", undefined, locale),
      ],
      action: "CONNECT",
    },
    {
      id: 3,
      title: t("tut.s3.title", undefined, locale),
      lines: [
        t("tut.s3.l1", undefined, locale),
        t("tut.s3.l2", { faucet: FAUCET_PATH }, locale),
        t("tut.s3.l3", undefined, locale),
        t("tut.s3.l4", undefined, locale),
      ],
      action: "WHOAMI",
    },
    {
      id: 4,
      title: t("tut.s4.title", undefined, locale),
      lines: [
        t("tut.s4.l1", undefined, locale),
        t("tut.s4.l2", undefined, locale),
        t("tut.s4.l3", undefined, locale),
        t("tut.s4.l4", undefined, locale),
      ],
      action: "TRANSMIT",
    },
    {
      id: 5,
      title: t("tut.s5.title", undefined, locale),
      lines: [
        t("tut.s5.l1", undefined, locale),
        t("tut.s5.l2", undefined, locale),
        t("tut.s5.l3", undefined, locale),
      ],
      action: "MEMORY",
    },
    {
      id: 6,
      title: t("tut.s6.title", undefined, locale),
      lines: [
        t("tut.s6.l1", undefined, locale),
        t("tut.s6.l2", undefined, locale),
        t("tut.s6.l3", undefined, locale),
        t("tut.s6.l4", undefined, locale),
      ],
      action: "SEAL",
    },
  ];
}

/** @deprecated use getTutorialSteps() — kept for any static imports */
export const TUTORIAL_STEPS = getTutorialSteps("fr");
