"use client";

import { useEffect, useRef } from "react";
import type { NodeStatus } from "@/domain/types";
import styles from "./Oscilloscope.module.css";

type OscilloscopeProps = {
  /** Median sat/vB of projected next block */
  nextFeeSatVb?: number;
  nextFeeMin?: number;
  nextFeeMax?: number;
  /** Tx count packed into next-block template */
  nextBlockTx?: number;
  /** Fees paid by txs in next-block template (sats) */
  nextTotalFees?: number;
  mempoolFill?: number;
  tipAgeSec?: number;
  blockHeight?: number;
  nodeStatus?: NodeStatus;
  activity?: number;
  reducedMotion?: boolean;
  /** ms of last successful probe */
  lastProbeAt?: number;
};

const BUF = 320;

/**
 * SIGNAL driven by mempool.space next-block projection:
 * - center trace ← median fee
 * - envelope width ← feeRange (min…max)
 * - packing noise ← nTx in next block
 * - brightness bias ← totalFees
 * - overdue bias ← tip age
 * - green spike ← tip height advance
 */
export function Oscilloscope({
  nextFeeSatVb = 1,
  nextFeeMin = 1,
  nextFeeMax = 1,
  nextBlockTx = 0,
  nextTotalFees = 0,
  mempoolFill = 0,
  tipAgeSec = 0,
  blockHeight = 0,
  nodeStatus = "ONLINE",
  activity = 0.15,
  reducedMotion = false,
  lastProbeAt = 0,
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef(blockHeight);
  const pulseRef = useRef(0);
  const medianBuf = useRef(new Float32Array(BUF));
  const minBuf = useRef(new Float32Array(BUF));
  const maxBuf = useRef(new Float32Array(BUF));
  const headRef = useRef(0);
  const rafRef = useRef(0);
  const paramsRef = useRef({
    nextFeeSatVb,
    nextFeeMin,
    nextFeeMax,
    nextBlockTx,
    nextTotalFees,
    mempoolFill,
    tipAgeSec,
    blockHeight,
    nodeStatus,
    activity,
  });
  paramsRef.current = {
    nextFeeSatVb,
    nextFeeMin,
    nextFeeMax,
    nextBlockTx,
    nextTotalFees,
    mempoolFill,
    tipAgeSec,
    blockHeight,
    nodeStatus,
    activity,
  };

  useEffect(() => {
    if (blockHeight > 0 && tipRef.current > 0 && blockHeight > tipRef.current) {
      pulseRef.current = 1;
    }
    tipRef.current = blockHeight;
  }, [blockHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    let sampleClock = 0;

    const push = (median: number, lo: number, hi: number) => {
      const i = headRef.current % BUF;
      medianBuf.current[i] = median;
      minBuf.current[i] = lo;
      maxBuf.current[i] = hi;
      headRef.current += 1;
    };

    const sampleTriple = (t: number) => {
      const p = paramsRef.current;
      if (p.nodeStatus === "OFFLINE") return { m: 0, lo: 0, hi: 0 };

      const feeNorm = Math.min(
        1,
        Math.log10(Math.max(p.nextFeeSatVb, 1) + 1) / 2.2,
      );
      const minNorm = Math.min(
        1,
        Math.log10(Math.max(p.nextFeeMin, 1) + 1) / 2.2,
      );
      const maxNorm = Math.min(
        1,
        Math.log10(Math.max(p.nextFeeMax, 1) + 1) / 2.2,
      );
      const fill = Math.min(1.4, p.mempoolFill);
      const txDensity = Math.min(1, p.nextBlockTx / 2500);
      const feeMass = Math.min(1, Math.log10(Math.max(p.nextTotalFees, 1)) / 8);
      const overdue = Math.min(1, Math.max(0, p.tipAgeSec - 30) / 600);
      const degraded = p.nodeStatus === "DEGRADED" ? 0.55 : 1;

      const carrier =
        Math.sin(t * 0.48) * (0.2 + feeNorm * 0.48) +
        Math.sin(t * 1.1 + feeNorm) * 0.08;
      const packing =
        (hashNoise(t * 5.5 + p.nextBlockTx * 0.02) - 0.5) *
        (0.1 + fill * 0.35 + txDensity * 0.35) *
        degraded;
      const wait = overdue * 0.3 + Math.sin(t * 0.18) * overdue * 0.1;
      const mass = feeMass * 0.12;
      const traffic = Math.sin(t * 2.6) * p.activity * 0.25;

      let m = carrier + packing + wait + mass + traffic;
      if (pulseRef.current > 0) m += pulseRef.current * 1.35;

      const spread = Math.max(0.04, (maxNorm - minNorm) * 0.55 + 0.06);
      const lo = m - spread * (0.7 + minNorm * 0.3);
      const hi = m + spread * (0.7 + maxNorm * 0.3);

      return {
        m: clamp(m, -1.35, 1.45),
        lo: clamp(lo, -1.4, 1.4),
        hi: clamp(hi, -1.4, 1.5),
      };
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = paramsRef.current;
      const feeNorm = Math.min(
        1,
        Math.log10(Math.max(p.nextFeeSatVb, 1) + 1) / 2.2,
      );
      const fill = Math.min(1.2, p.mempoolFill);

      sampleClock += dt * (38 + feeNorm * 28 + fill * 36 + p.activity * 18);
      while (sampleClock >= 1) {
        sampleClock -= 1;
        const t = headRef.current * 0.16 + p.blockHeight * 0.015;
        const s = sampleTriple(t);
        push(s.m, s.lo, s.hi);
      }

      if (pulseRef.current > 0) {
        pulseRef.current = Math.max(0, pulseRef.current - dt * 1.35);
      }

      drawRecorder(
        ctx,
        w,
        h,
        medianBuf.current,
        minBuf.current,
        maxBuf.current,
        headRef.current,
        p.mempoolFill,
        pulseRef.current,
        p.nodeStatus === "OFFLINE",
        p.nextFeeSatVb,
      );

      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (reducedMotion) {
      for (let i = 0; i < BUF; i++) {
        const s = sampleTriple(i * 0.16);
        medianBuf.current[i] = s.m;
        minBuf.current[i] = s.lo;
        maxBuf.current[i] = s.hi;
      }
      headRef.current = BUF;
      drawRecorder(
        ctx,
        w,
        h,
        medianBuf.current,
        minBuf.current,
        maxBuf.current,
        headRef.current,
        mempoolFill,
        0,
        nodeStatus === "OFFLINE",
        nextFeeSatVb,
      );
      return () => ro.disconnect();
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [reducedMotion, nextFeeSatVb, mempoolFill, nodeStatus]);

  const fillPct = Math.min(999, Math.round(mempoolFill * 100));
  const mode =
    nodeStatus === "OFFLINE"
      ? "DOWN"
      : mempoolFill >= 1
        ? "FULL"
        : mempoolFill >= 0.45
          ? "PACKING"
          : tipAgeSec > 600
            ? "OVERDUE"
            : "BUILDING";
  const offline = nodeStatus === "OFFLINE";
  const fee = nextFeeSatVb > 0 ? nextFeeSatVb : null;
  const probeAge =
    lastProbeAt > 0
      ? formatAge(Math.max(0, Math.floor((Date.now() - lastProbeAt) / 1000)))
      : null;

  return (
    <div
      className={[styles.wrap, offline ? styles.wrapDown : ""].filter(Boolean).join(" ")}
      data-health={nodeStatus}
    >
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroLabel}>
            {offline ? "SIGNAL" : "NEXT BLOCK"}
          </span>
          <span className={styles.heroValue}>
            {offline ? "——" : fee != null ? String(fee) : "—"}
          </span>
          <span className={styles.heroUnit}>
            {offline ? "LOST" : "sat/vB"}
          </span>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
      </div>
      <div
        className={[styles.readout, offline ? styles.readoutDown : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {offline ? (
          <>
            <span>TESTNET4 UNREACHABLE</span>
            <span>FLATLINE</span>
            <span>RETRYING…</span>
          </>
        ) : (
          <>
            <span>
              {nextFeeMin > 0 && nextFeeMax > 0
                ? `RANGE ${nextFeeMin}–${nextFeeMax}`
                : "RANGE —"}
            </span>
            <span>
              FILL {fillPct}% · {mode}
              {nextBlockTx > 0 ? ` · ${nextBlockTx} TX` : ""}
            </span>
            <span>
              TIP {blockHeight || "—"}
              {tipAgeSec > 0 ? ` +${formatAge(tipAgeSec)}` : ""}
              {probeAge != null ? ` · SYNC ${probeAge}` : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function formatAge(sec: number): string {
  if (sec < 90) return `${sec}s`;
  return `${Math.floor(sec / 60)}m`;
}

function hashNoise(t: number): number {
  const x = Math.sin(t * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawRecorder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  median: Float32Array,
  lo: Float32Array,
  hi: Float32Array,
  head: number,
  fill: number,
  pulse: number,
  offline: boolean,
  nextFee: number,
) {
  ctx.clearRect(0, 0, w, h);
  const mid = h * 0.52;
  const amp = h * 0.36;
  const n = Math.min(BUF, head);
  if (n < 2) return;

  // baseline
  ctx.strokeStyle = "rgba(200, 160, 60, 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();

  // fill capacity guide
  const fillY = mid - amp * (0.18 + Math.min(1, fill) * 0.72);
  ctx.strokeStyle =
    fill >= 1 ? "rgba(200, 80, 50, 0.35)" : "rgba(200, 160, 60, 0.12)";
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(0, fillY);
  ctx.lineTo(w, fillY);
  ctx.stroke();
  ctx.setLineDash([]);

  // fee-range envelope (min…max of next block)
  if (!offline) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const idx = (head - n + i + BUF * 8) % BUF;
      const x = (i / (n - 1)) * w;
      const y = mid - hi[idx]! * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const idx = (head - n + i + BUF * 8) % BUF;
      const x = (i / (n - 1)) * w;
      const y = mid - lo[idx]! * amp;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle =
      fill >= 1
        ? "rgba(200, 120, 50, 0.14)"
        : "rgba(200, 160, 60, 0.12)";
    ctx.fill();
  }

  const feeNorm = Math.min(1, Math.log10(Math.max(nextFee, 1) + 1) / 2.2);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = offline
    ? "rgba(160, 120, 40, 0.35)"
    : pulse > 0.2
      ? "rgba(90, 200, 100, 0.95)"
      : fill >= 1
        ? "rgba(220, 140, 70, 0.95)"
        : `rgba(220, 180, ${70 + feeNorm * 40}, 0.95)`;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const idx = (head - n + i + BUF * 8) % BUF;
    const x = (i / (n - 1)) * w;
    const y = mid - median[idx]! * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle =
    pulse > 0.15 ? "rgba(90, 200, 100, 0.9)" : "rgba(220, 180, 70, 0.55)";
  ctx.fillRect(w - 2, 2, 2, h - 4);
}
