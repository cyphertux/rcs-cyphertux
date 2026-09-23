"use client";

import { GLYPH } from "@/domain/types";
import { useLocale } from "@/locale";
import styles from "./SignalPath.module.css";

export type SignalStage = "signal" | "broadcast" | "confirmed";

type SignalPathProps = {
  stage: SignalStage;
  sats?: number;
  reducedMotion?: boolean;
};

/** Intensity 1–4 from ritual value (≤209→1, 210→2, 2100→3, 21k+→4) */
export function signalIntensity(sats: number): 1 | 2 | 3 | 4 {
  if (sats >= 21000) return 4;
  if (sats >= 2100) return 3;
  if (sats >= 210) return 2;
  return 1;
}

function activeHopIndex(stage: SignalStage): number {
  if (stage === "signal") return 1;
  if (stage === "broadcast") return 3;
  return 4;
}

export function SignalPath({
  stage,
  sats = 546,
  reducedMotion = false,
}: SignalPathProps) {
  const { t } = useLocale();
  const intensity = signalIntensity(sats);
  const active = activeHopIndex(stage);
  const packetCount = intensity;
  const hops = [
    { id: "op", glyph: GLYPH.TRANSMISSION, label: "OP" },
    { id: "ch", glyph: GLYPH.CHANNEL, label: "CH" },
    { id: "net", glyph: GLYPH.NODE, label: "NET" },
    { id: "sink", glyph: GLYPH.MARK, label: t("sig.sink") },
    { id: "mem", glyph: GLYPH.MEMORY, label: "MEM" },
  ] as const;

  return (
    <div
      className={[
        styles.path,
        styles[stage],
        styles[`i${intensity}`],
        reducedMotion ? styles.static : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-intensity={intensity}
      aria-hidden
    >
      <div className={styles.phase}>
        {stage === "signal"
          ? t("sig.encode")
          : stage === "broadcast"
            ? t("sig.broadcast")
            : t("sig.settle")}
      </div>

      <div className={styles.hops}>
        {hops.map((hop, i) => (
          <div key={hop.id} className={styles.hopGroup}>
            <div
              className={[
                styles.node,
                i <= active ? styles.nodeLit : "",
                i === active ? styles.nodeActive : "",
                stage === "confirmed" && i === hops.length - 1
                  ? styles.nodeSettled
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.glyph}>{hop.glyph}</span>
              <span className={styles.hopLabel}>{hop.label}</span>
            </div>
            {i < hops.length - 1 ? (
              <div
                className={[
                  styles.segment,
                  i < active ? styles.segmentFilled : "",
                  i === active - 1 && stage !== "confirmed"
                    ? styles.segmentLive
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.beam} />
                {Array.from({ length: packetCount }, (_, p) => (
                  <div
                    key={p}
                    className={styles.packet}
                    style={{
                      animationDelay: reducedMotion
                        ? undefined
                        : `${p * 0.18}s`,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.meta}>
        <span>{t("sig.intensity", { n: intensity })}</span>
        <span>{sats} SAT</span>
      </div>
    </div>
  );
}
