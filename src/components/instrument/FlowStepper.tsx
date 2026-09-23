"use client";

import styles from "./FlowStepper.module.css";

type Props = {
  steps: string[];
  activeIndex: number;
};

/** Compact phosphor step rail: VALEUR — MSG — CONFIRM */
export function FlowStepper({ steps, activeIndex }: Props) {
  return (
    <div className={styles.rail} aria-hidden>
      {steps.map((label, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <span key={`${label}-${i}`} className={styles.chunk}>
            {i > 0 ? <span className={styles.sep}>—</span> : null}
            <span
              className={[
                styles.step,
                active ? styles.active : "",
                done ? styles.done : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {done ? "✓ " : active ? "" : "· "}
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
