"use client";

import { useCallback, useEffect, useState } from "react";
import { playCue } from "@/audio/audioSystem";
import { useMachineStore } from "@/state/machineStore";
import styles from "./BootSequence.module.css";

const LINES = [
  "POWER",
  "",
  "CHANNEL 07",
  "LINK .............. WAIT",
  "LINK .............. OK",
  "",
  "REMOTE COMMUNICATION SYSTEM",
  "",
  "PRESS ENTER",
];

export function BootSequence() {
  const finishBoot = useMachineStore((s) => s.finishBoot);
  const reducedMotion = useMachineStore((s) => s.reducedMotion);
  const [count, setCount] = useState(reducedMotion ? LINES.length : 0);
  const [done, setDone] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= LINES.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 140);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const complete = useCallback(() => {
    playCue("beep");
    finishBoot();
  }, [finishBoot]);

  useEffect(() => {
    if (!done || reducedMotion) return;
    const id = window.setTimeout(() => complete(), 900);
    return () => window.clearTimeout(id);
  }, [complete, done, reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (done) complete();
        else {
          setCount(LINES.length);
          setDone(true);
        }
      }
      if (e.key === "Escape") complete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete, done]);

  return (
    <div className={styles.boot} role="status" aria-live="polite">
      <div className={styles.spacer} />
      <div className={styles.block}>
        {LINES.slice(0, count).map((line, idx) => (
          <div
            key={`${idx}-${line}`}
            className={
              line === "REMOTE COMMUNICATION SYSTEM" || line === "PRESS ENTER"
                ? styles.bright
                : styles.line
            }
          >
            {line || "\u00A0"}
          </div>
        ))}
        {done ? <span className={styles.cursor} aria-hidden /> : null}
      </div>
      <div className={styles.spacer} />
      {done ? (
        <button type="button" className={styles.action} onClick={complete}>
          ENTER
        </button>
      ) : (
        <button type="button" className={styles.skip} onClick={complete}>
          SKIP
        </button>
      )}
    </div>
  );
}
