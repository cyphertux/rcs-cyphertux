"use client";

import { DUST_SATS } from "@/bitcoin/config";
import { formatSats } from "@/domain/format";
import { GLYPH } from "@/domain/types";
import { useWallet } from "@/wallet/WalletContext";
import { useMachineStore } from "@/state/machineStore";
import { Glyph } from "./Glyph";
import styles from "./IdleView.module.css";

type OpPhase = "link" | "fund" | "ready";

function opPhase(connected: boolean, balance: number): OpPhase {
  if (!connected) return "link";
  if (balance < DUST_SATS) return "fund";
  return "ready";
}

const PHASES: { id: OpPhase; label: string; cmd: string }[] = [
  { id: "link", label: "LINK", cmd: "CONNECT" },
  { id: "fund", label: "FUND", cmd: "TUTORIAL" },
  { id: "ready", label: "READY", cmd: "TRANSMIT" },
];

/** Instrument idle only — Minitel has its own sommaire */
export function IdleView() {
  const status = useMachineStore((s) => s.status);
  const reveal = useMachineStore((s) => s.networkReveal);
  const wallet = useWallet();
  const degraded = status.nodeStatus === "DEGRADED";
  const phase = opPhase(wallet.connected, wallet.balanceSats);
  const activeIdx = PHASES.findIndex((p) => p.id === phase);

  return (
    <div className={styles.idle} data-health={status.nodeStatus}>
      <div className={styles.center}>
        <Glyph
          name={phase === "ready" ? "TRANSMISSION" : "NODE"}
          size="xl"
          pulse
        />
        <p className={styles.established}>
          {phase === "link"
            ? "OPERATOR UNLINKED"
            : phase === "fund"
              ? "AWAITING FUNDS"
              : "READY TO TRANSMIT"}
        </p>
        {degraded ? (
          <p className={styles.degradedHint}>CHAIN DEGRADED · TIP PARTIAL</p>
        ) : null}

        <ol className={styles.rail} aria-label="Operator path">
          {PHASES.map((p, i) => {
            const state =
              i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
            return (
              <li key={p.id} className={styles.railItem} data-state={state}>
                <span className={styles.railMark}>
                  {state === "done"
                    ? GLYPH.NODE
                    : state === "active"
                      ? GLYPH.TRANSMISSION
                      : GLYPH.OFFLINE}
                </span>
                <span className={styles.railLabel}>{p.label}</span>
                {i < PHASES.length - 1 ? (
                  <span className={styles.railArrow} aria-hidden>
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <p className={styles.hintCmd}>
          TYPE {PHASES[activeIdx]?.cmd ?? "HELP"}
          {phase === "ready"
            ? ` · BALANCE ${formatSats(wallet.balanceSats)}`
            : ""}
        </p>
      </div>

      <div className={styles.bottomData}>
        {reveal >= 1 ? (
          <div className={styles.proto}>BTC TESTNET4</div>
        ) : (
          <div className={styles.protoDim}>····</div>
        )}
        <div className={styles.block}>{status.blockHeight || "········"}</div>
        {reveal >= 3 ? (
          <div className={styles.detected}>BITCOIN TESTNET DETECTED</div>
        ) : reveal === 0 ? (
          <div className={styles.unknown}>NETWORK UNKNOWN</div>
        ) : (
          <div className={styles.unknown}>{status.networkLabel}</div>
        )}
      </div>
    </div>
  );
}
