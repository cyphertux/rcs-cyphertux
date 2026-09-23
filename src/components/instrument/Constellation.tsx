"use client";

import { GLYPH } from "@/domain/types";
import styles from "./Constellation.module.css";

type ConstellationProps = {
  active?: boolean;
  reveal?: number;
  reducedMotion?: boolean;
};

const PEERS = [
  { x: 50, y: 18 },
  { x: 22, y: 38 },
  { x: 78, y: 36 },
  { x: 14, y: 62 },
  { x: 86, y: 58 },
  { x: 35, y: 78 },
  { x: 65, y: 80 },
  { x: 50, y: 50 }, // center node
];

export function Constellation({
  active = true,
  reveal = 1,
  reducedMotion = false,
}: ConstellationProps) {
  const visiblePeers = Math.min(8, 3 + reveal * 2);
  const center = PEERS[7]!;

  return (
    <div
      className={[
        styles.wrap,
        active ? styles.active : "",
        reducedMotion ? styles.static : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className={styles.svg}>
        {PEERS.slice(0, visiblePeers - 1).map((p, i) => (
          <line
            key={`l-${i}`}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            className={styles.link}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
        {PEERS.slice(0, visiblePeers - 1).map((p, i) => (
          <circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r="1.2"
            className={styles.peer}
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
        <text
          x={center.x}
          y={center.y + 2.5}
          textAnchor="middle"
          className={styles.node}
        >
          {GLYPH.NODE}
        </text>
      </svg>
    </div>
  );
}
