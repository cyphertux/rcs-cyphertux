"use client";

import { formatDayLabel, formatSats, todayKey, truncateTxid } from "@/domain/format";
import { useLocale } from "@/locale";
import type { MessageKey } from "@/locale/core";
import { useMachineStore } from "@/state/machineStore";
import { LcdList, LcdListItem, LcdPanel } from "./LcdPanel";
import styles from "./LcdPanel.module.css";
import cal from "./CalendarView.module.css";

/** Estimate calendar day when a seal unlocks (~10 min/block from tip). */
export function unlockDayKey(
  unlockHeight: number,
  tip: number,
  now = new Date(),
): string | null {
  if (!(tip > 0) || !(unlockHeight > 0)) return null;
  const blocksLeft = Math.max(0, unlockHeight - tip);
  const ms = blocksLeft * 10 * 60 * 1000;
  const d = new Date(now.getTime() + ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD from ISO timestamp (not UTC slice). */
function createdDayKey(iso: string): string {
  return todayKey(new Date(iso));
}

export function CalendarView() {
  const { t } = useLocale();
  const flow = useMachineStore((s) => s.flow);
  const memory = useMachineStore((s) => s.memory);
  const tip = useMachineStore((s) => s.status.blockHeight);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey(now);
  const monthKey = `cal.m${month + 1}` as MessageKey;

  /** Upcoming seals only — revealed already unlocked */
  const unlocksByDay = (key: string) =>
    memory.filter((m) => {
      if (m.kind !== "sealed" || m.unlockHeight == null) return false;
      return unlockDayKey(m.unlockHeight, tip, now) === key;
    });

  if (flow?.kind === "calendar" && flow.step === "day" && flow.selectedDate) {
    const key = flow.selectedDate;
    const entries = memory.filter((tr) => createdDayKey(tr.createdAt) === key);
    const unlocks = unlocksByDay(key);
    const future = key > today;

    return (
      <LcdPanel
        title={t("cal.title")}
        meta={formatDayLabel(key)}
        hint={t("cal.hintDay")}
      >
        {future && unlocks.length === 0 ? (
          <p className={styles.line}>{t("cal.locked")}</p>
        ) : entries.length === 0 && unlocks.length === 0 ? (
          <p className={styles.line}>{t("cal.silent")}</p>
        ) : (
          <>
            {future ? (
              <p className={styles.line}>{t("cal.futureUnlocks")}</p>
            ) : null}
            <LcdList>
              {unlocks.map((e) => (
                <LcdListItem
                  key={`u-${e.txid}`}
                  code={t("cal.unlockMark")}
                  desc={`H${e.unlockHeight} · ${formatSats(e.sats)} · ${truncateTxid(e.txid)}`}
                />
              ))}
              {!future
                ? entries.map((e) => (
                    <LcdListItem
                      key={e.txid}
                      code={`#${e.id}`}
                      desc={`${formatSats(e.sats)} · ${truncateTxid(e.txid)}`}
                    />
                  ))
                : null}
            </LcdList>
          </>
        )}
      </LcdPanel>
    );
  }

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const count = memory.filter((tr) => createdDayKey(tr.createdAt) === key).length;
    const unlockCount = unlocksByDay(key).length;
    return {
      d,
      key,
      count,
      unlockCount,
      isToday: key === today,
      locked: key > today,
    };
  });

  const monthCount = memory.filter((m) => {
    const k = createdDayKey(m.createdAt);
    return k.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`;
  }).length;
  const monthUnlocks = cells.reduce((n, c) => n + c.unlockCount, 0);

  return (
    <LcdPanel
      title={t("cal.title")}
      meta={`${t(monthKey)} ${year}`}
      hint={t("cal.hintMonth")}
    >
      <p className={styles.line}>
        {t("cal.lead", { n: monthCount })}
        {monthUnlocks > 0 ? ` · ${t("cal.unlocks", { n: monthUnlocks })}` : ""}
      </p>
      <div className={cal.grid}>
        {cells.map((c) => (
          <div
            key={c.key}
            className={[
              cal.cell,
              c.count > 0 || c.unlockCount > 0 ? cal.cellActive : "",
              c.isToday ? cal.cellToday : "",
              c.locked ? cal.cellLocked : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={cal.day}>{String(c.d).padStart(2, "0")}</span>
            <span className={cal.mark}>
              {(() => {
                const parts: string[] = [];
                if (c.unlockCount > 0) parts.push(`▣${c.unlockCount}`);
                if (!c.locked && c.count > 0) parts.push(`◆${c.count}`);
                if (parts.length > 0) return parts.join(" ");
                return c.locked ? "·" : "—";
              })()}
            </span>
          </div>
        ))}
      </div>
    </LcdPanel>
  );
}
