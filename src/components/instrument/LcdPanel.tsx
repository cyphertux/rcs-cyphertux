"use client";

import type { ReactNode } from "react";
import styles from "./LcdPanel.module.css";

/** Shared RCS LCD chrome for every service screen */
export function LcdPanel({
  title,
  meta,
  children,
  hint,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <span className={styles.title}>■ {title} ■</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </header>
      <div className={styles.body}>{children}</div>
      {hint ? <footer className={styles.hint}>{hint}</footer> : null}
    </div>
  );
}

export function LcdRow({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "warn";
  href?: string;
}) {
  const valueClass = [
    styles.rowValue,
    tone === "ok" ? styles.ok : "",
    tone === "bad" ? styles.bad : "",
    tone === "warn" ? styles.warn : "",
    href ? styles.rowLink : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      {href ? (
        <a
          className={valueClass}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {value}
        </a>
      ) : (
        <span className={valueClass}>{value}</span>
      )}
    </div>
  );
}

export function LcdHero({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroValue}>{children}</div>
      {sub ? <div className={styles.heroSub}>{sub}</div> : null}
    </div>
  );
}

export function LcdBox({ children }: { children: ReactNode }) {
  return <div className={styles.box}>{children}</div>;
}

export function LcdLines({ lines }: { lines: string[] }) {
  return (
    <div className={styles.lines}>
      {lines.map((line) => (
        <p key={line} className={styles.line}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function LcdList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

export function LcdListItem({
  code,
  desc,
  active,
}: {
  code: string;
  desc: string;
  active?: boolean;
}) {
  return (
    <li
      className={[styles.item, active ? styles.itemOn : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.itemCode}>{code}</span>
      <span className={styles.itemDesc}>{desc}</span>
    </li>
  );
}
