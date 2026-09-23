"use client";

import type { CursorMode } from "@/domain/types";
import styles from "./InstrumentCursor.module.css";

type InstrumentCursorProps = {
  mode: CursorMode;
};

export function InstrumentCursor({ mode }: InstrumentCursorProps) {
  return (
    <span
      className={[styles.cursor, styles[mode]].join(" ")}
      data-instrument-cursor
      aria-hidden
    />
  );
}
